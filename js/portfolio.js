/**
 * 포트폴리오 트래커 - 핵심 데이터 로직
 * 거래 관리, 보유 종목 계산, NAV 산출
 */

class PortfolioManager {
    constructor() {
        this.STORAGE_KEY = 'portfolio_tracker_data';
        this.data = this.load();
    }

    // ── 데이터 구조 ────────────────────────────
    getDefaultData() {
        return {
            transactions: [],       // 전체 거래 내역
            currentPrices: {},      // { ticker: { price, currency, updatedAt } }
            settings: {
                baseCurrency: 'KRW',
                exchangeRate: 1380   // USD → KRW 환율 (수동 설정)
            }
        };
    }

    // ── 저장 / 불러오기 ────────────────────────
    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // 기본값 병합 (이전 버전 호환)
                return { ...this.getDefaultData(), ...parsed };
            }
        } catch (e) {
            console.error('데이터 로드 실패:', e);
        }
        return this.getDefaultData();
    }

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('데이터 저장 실패:', e);
        }
    }

    // ── 거래 관리 ──────────────────────────────
    /**
     * 거래 추가
     * @param {Object} tx - { type, date, ticker, name, quantity, price, fee, currency, memo }
     */
    addTransaction(tx) {
        const transaction = {
            id: this.generateId(),
            type: tx.type,              // 'buy' | 'sell'
            date: tx.date,              // 'YYYY-MM-DD'
            ticker: tx.ticker.toUpperCase().trim(),
            name: tx.name || tx.ticker.toUpperCase().trim(),
            quantity: parseFloat(tx.quantity),
            price: parseFloat(tx.price),
            fee: parseFloat(tx.fee) || 0,
            currency: tx.currency || 'USD',
            memo: tx.memo || '',
            createdAt: new Date().toISOString()
        };

        this.data.transactions.push(transaction);

        // 현재가가 없으면 매수/매도 가격으로 설정
        if (!this.data.currentPrices[transaction.ticker]) {
            this.data.currentPrices[transaction.ticker] = {
                price: transaction.price,
                currency: transaction.currency,
                updatedAt: transaction.date
            };
        }

        this.save();
        return transaction;
    }

    /**
     * 거래 수정
     */
    updateTransaction(id, updates) {
        const idx = this.data.transactions.findIndex(t => t.id === id);
        if (idx === -1) return null;

        if (updates.ticker) updates.ticker = updates.ticker.toUpperCase().trim();
        if (updates.quantity) updates.quantity = parseFloat(updates.quantity);
        if (updates.price) updates.price = parseFloat(updates.price);
        if (updates.fee !== undefined) updates.fee = parseFloat(updates.fee) || 0;

        this.data.transactions[idx] = { ...this.data.transactions[idx], ...updates };
        this.save();
        return this.data.transactions[idx];
    }

    /**
     * 거래 삭제
     */
    deleteTransaction(id) {
        this.data.transactions = this.data.transactions.filter(t => t.id !== id);
        this.save();
    }

    /**
     * 전체 거래 내역 (날짜순 정렬)
     */
    getTransactions(filters = {}) {
        let txs = [...this.data.transactions];

        if (filters.ticker) {
            txs = txs.filter(t => t.ticker === filters.ticker);
        }
        if (filters.type) {
            txs = txs.filter(t => t.type === filters.type);
        }

        txs.sort((a, b) => new Date(b.date) - new Date(a.date));
        return txs;
    }

    // ── 현재가 관리 ────────────────────────────
    updateCurrentPrice(ticker, price, currency) {
        this.data.currentPrices[ticker] = {
            price: parseFloat(price),
            currency: currency || 'USD',
            updatedAt: new Date().toISOString().split('T')[0]
        };
        this.save();
    }

    getCurrentPrice(ticker) {
        return this.data.currentPrices[ticker] || null;
    }

    // ── 환율 ───────────────────────────────────
    getExchangeRate() {
        return this.data.settings.exchangeRate;
    }

    setExchangeRate(rate) {
        this.data.settings.exchangeRate = parseFloat(rate);
        this.save();
    }

    /**
     * 금액을 KRW로 변환
     */
    toKRW(amount, currency) {
        if (currency === 'KRW') return amount;
        return amount * this.data.settings.exchangeRate;
    }

    /**
     * 금액을 USD로 변환
     */
    toUSD(amount, currency) {
        if (currency === 'USD') return amount;
        return amount / this.data.settings.exchangeRate;
    }

    // ── 보유 종목 계산 ─────────────────────────
    /**
     * 현재 보유 종목 계산
     * 거래 내역을 기반으로 각 종목의 보유수량, 평균 매수가 계산
     */
    getHoldings() {
        const holdingsMap = {};

        // 날짜순 정렬 (오래된 것부터)
        const sortedTxs = [...this.data.transactions].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );

        for (const tx of sortedTxs) {
            if (!holdingsMap[tx.ticker]) {
                holdingsMap[tx.ticker] = {
                    ticker: tx.ticker,
                    name: tx.name,
                    quantity: 0,
                    totalCost: 0,       // 총 투자금액 (수수료 포함)
                    avgPrice: 0,
                    currency: tx.currency,
                    totalFees: 0
                };
            }

            const h = holdingsMap[tx.ticker];

            if (tx.type === 'buy') {
                h.totalCost += (tx.quantity * tx.price) + tx.fee;
                h.quantity += tx.quantity;
                h.totalFees += tx.fee;
                h.avgPrice = h.quantity > 0 ? (h.totalCost / h.quantity) : 0;
                h.name = tx.name || h.name;
            } else if (tx.type === 'sell') {
                if (h.quantity > 0) {
                    // 매도 시: 평균단가 기준으로 투자원금 비례 차감
                    const costPerShare = h.totalCost / h.quantity;
                    h.totalCost -= costPerShare * tx.quantity;
                    h.quantity -= tx.quantity;
                    h.totalFees += tx.fee;
                    if (h.quantity <= 0.0001) {
                        h.quantity = 0;
                        h.totalCost = 0;
                        h.avgPrice = 0;
                    } else {
                        h.avgPrice = h.totalCost / h.quantity;
                    }
                }
            }
        }

        // 보유 수량 > 0인 종목만 반환
        const holdings = Object.values(holdingsMap).filter(h => h.quantity > 0.0001);

        // 현재가 및 수익률 계산
        const totalPortfolioValueKRW = holdings.reduce((sum, h) => {
            const priceInfo = this.getCurrentPrice(h.ticker);
            const currentPrice = priceInfo ? priceInfo.price : h.avgPrice;
            return sum + this.toKRW(currentPrice * h.quantity, h.currency);
        }, 0);

        return holdings.map(h => {
            const priceInfo = this.getCurrentPrice(h.ticker);
            const currentPrice = priceInfo ? priceInfo.price : h.avgPrice;
            const currentValue = currentPrice * h.quantity;
            const pnl = currentValue - h.totalCost;
            const pnlPercent = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
            const currentValueKRW = this.toKRW(currentValue, h.currency);
            const weight = totalPortfolioValueKRW > 0
                ? (currentValueKRW / totalPortfolioValueKRW) * 100
                : 0;

            return {
                ...h,
                currentPrice,
                currentValue,
                pnl,
                pnlPercent,
                weight
            };
        });
    }

    /**
     * 고유 종목 목록
     */
    getUniqueTickers() {
        const tickers = new Set(this.data.transactions.map(t => t.ticker));
        return [...tickers].sort();
    }

    // ── 포트폴리오 요약 ────────────────────────
    getSummary() {
        const holdings = this.getHoldings();

        let totalValueKRW = 0;
        let totalInvestedKRW = 0;
        let totalValueUSD = 0;
        let totalInvestedUSD = 0;

        for (const h of holdings) {
            totalValueKRW += this.toKRW(h.currentValue, h.currency);
            totalInvestedKRW += this.toKRW(h.totalCost, h.currency);
            totalValueUSD += this.toUSD(h.currentValue, h.currency);
            totalInvestedUSD += this.toUSD(h.totalCost, h.currency);
        }

        const totalPnlKRW = totalValueKRW - totalInvestedKRW;
        const totalPnlUSD = totalValueUSD - totalInvestedUSD;
        const totalPnlPercent = totalInvestedKRW > 0
            ? (totalPnlKRW / totalInvestedKRW) * 100
            : 0;

        return {
            totalValueKRW,
            totalInvestedKRW,
            totalPnlKRW,
            totalValueUSD,
            totalInvestedUSD,
            totalPnlUSD,
            totalPnlPercent,
            holdingsCount: holdings.length,
            transactionsCount: this.data.transactions.length
        };
    }

    // ── NAV 히스토리 계산 ──────────────────────
    /**
     * 날짜별 포트폴리오 가치 계산
     * 각 거래 시점에서의 보유 종목 가치를 계산
     * 거래가 없는 날은 마지막 알려진 가격으로 보간
     */
    calculateNAVHistory() {
        if (this.data.transactions.length === 0) return [];

        const sortedTxs = [...this.data.transactions].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );

        // 각 날짜별 가격 기록 수집
        const priceHistory = {}; // { ticker: { date: price } }
        for (const tx of sortedTxs) {
            if (!priceHistory[tx.ticker]) priceHistory[tx.ticker] = {};
            priceHistory[tx.ticker][tx.date] = tx.price;
        }

        // 모든 거래 날짜 수집
        const allDates = [...new Set(sortedTxs.map(t => t.date))].sort();

        // 오늘 날짜도 추가
        const today = new Date().toISOString().split('T')[0];
        if (allDates[allDates.length - 1] !== today) {
            allDates.push(today);
        }

        // 날짜 사이를 채우기 (일 단위)
        const filledDates = [];
        if (allDates.length > 0) {
            const start = new Date(allDates[0]);
            const end = new Date(allDates[allDates.length - 1]);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                filledDates.push(d.toISOString().split('T')[0]);
            }
        }

        // 각 날짜별 보유 현황과 NAV 계산
        const navHistory = [];
        const holdingsState = {}; // { ticker: { quantity, totalCost, currency } }
        let txIndex = 0;

        for (const date of filledDates) {
            // 해당 날짜의 거래 적용
            while (txIndex < sortedTxs.length && sortedTxs[txIndex].date <= date) {
                const tx = sortedTxs[txIndex];
                if (!holdingsState[tx.ticker]) {
                    holdingsState[tx.ticker] = { quantity: 0, totalCost: 0, currency: tx.currency };
                }
                const h = holdingsState[tx.ticker];

                if (tx.type === 'buy') {
                    h.totalCost += (tx.quantity * tx.price) + tx.fee;
                    h.quantity += tx.quantity;
                } else if (tx.type === 'sell') {
                    if (h.quantity > 0) {
                        const costPerShare = h.totalCost / h.quantity;
                        h.totalCost -= costPerShare * tx.quantity;
                        h.quantity -= tx.quantity;
                        if (h.quantity <= 0.0001) {
                            h.quantity = 0;
                            h.totalCost = 0;
                        }
                    }
                }

                // 가격 기록
                if (!priceHistory[tx.ticker]) priceHistory[tx.ticker] = {};
                priceHistory[tx.ticker][tx.date] = tx.price;

                txIndex++;
            }

            // NAV 계산: 각 보유 종목의 가치 합산
            let totalValueKRW = 0;
            let totalCostKRW = 0;

            for (const [ticker, state] of Object.entries(holdingsState)) {
                if (state.quantity <= 0.0001) continue;

                // 해당 날짜 또는 가장 최근 알려진 가격 찾기
                let price = this.findNearestPrice(priceHistory[ticker], date);

                // 현재가가 있으면 오늘 날짜에는 현재가 사용
                if (date === today) {
                    const cp = this.getCurrentPrice(ticker);
                    if (cp) price = cp.price;
                }

                const value = state.quantity * price;
                totalValueKRW += this.toKRW(value, state.currency);
                totalCostKRW += this.toKRW(state.totalCost, state.currency);
            }

            navHistory.push({
                date,
                value: totalValueKRW,
                cost: totalCostKRW
            });
        }

        return navHistory;
    }

    /**
     * 주어진 날짜에 가장 가까운 가격 찾기
     */
    findNearestPrice(priceMap, targetDate) {
        if (!priceMap) return 0;
        if (priceMap[targetDate]) return priceMap[targetDate];

        const dates = Object.keys(priceMap).sort();
        let nearest = null;
        for (const d of dates) {
            if (d <= targetDate) {
                nearest = d;
            }
        }
        return nearest ? priceMap[nearest] : (dates.length > 0 ? priceMap[dates[0]] : 0);
    }

    // ── 데이터 내보내기/가져오기 ───────────────
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    importData(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (imported.transactions && Array.isArray(imported.transactions)) {
                this.data = { ...this.getDefaultData(), ...imported };
                this.save();
                return true;
            }
            return false;
        } catch (e) {
            console.error('데이터 가져오기 실패:', e);
            return false;
        }
    }

    // ── 유틸리티 ───────────────────────────────
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }
}

// 전역 인스턴스
const portfolio = new PortfolioManager();
