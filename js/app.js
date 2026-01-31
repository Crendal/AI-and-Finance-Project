/**
 * 포트폴리오 트래커 - 메인 애플리케이션
 * UI 이벤트 처리, 페이지 렌더링, 데이터 바인딩
 */

(function() {
    'use strict';

    // ── 상태 ───────────────────────────────────
    let currentPage = 'dashboard';
    let currentPeriod = 'all';

    // ── 초기화 ─────────────────────────────────
    document.addEventListener('DOMContentLoaded', function() {
        initNavigation();
        initTransactionForm();
        initFilters();
        initModals();
        initExportImport();
        initChartPeriod();
        setDefaultDate();
        refreshAll();
    });

    // ── 네비게이션 ─────────────────────────────
    function initNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const page = this.dataset.page;
                navigateTo(page);
            });
        });
    }

    function navigateTo(page) {
        currentPage = page;

        // 버튼 활성화
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });

        // 페이지 전환
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === 'page-' + page);
        });

        // 페이지별 새로고침
        if (page === 'dashboard') refreshDashboard();
        else if (page === 'holdings') refreshHoldings();
        else if (page === 'transactions') refreshTransactions();
    }

    // ── 대시보드 ───────────────────────────────
    function refreshDashboard() {
        const summary = portfolio.getSummary();
        const holdings = portfolio.getHoldings();
        const navHistory = portfolio.calculateNAVHistory();

        // 요약 카드 업데이트
        document.getElementById('total-value').textContent = formatKRW(summary.totalValueKRW);
        document.getElementById('total-value-usd').textContent = formatUSD(summary.totalValueUSD);
        document.getElementById('total-invested').textContent = formatKRW(summary.totalInvestedKRW);
        document.getElementById('total-invested-usd').textContent = formatUSD(summary.totalInvestedUSD);

        const pnlEl = document.getElementById('total-pnl');
        pnlEl.textContent = formatKRW(summary.totalPnlKRW);
        pnlEl.className = 'card-value ' + (summary.totalPnlKRW >= 0 ? 'positive' : 'negative');

        const pnlPctEl = document.getElementById('total-pnl-pct');
        const sign = summary.totalPnlPercent >= 0 ? '+' : '';
        pnlPctEl.textContent = sign + summary.totalPnlPercent.toFixed(2) + '%';
        pnlPctEl.className = 'card-sub ' + (summary.totalPnlPercent >= 0 ? 'positive' : 'negative');

        document.getElementById('total-holdings').textContent = summary.holdingsCount;
        document.getElementById('total-transactions').textContent = '총 거래: ' + summary.transactionsCount + '건';

        // 차트 렌더링
        charts.renderNAVChart(navHistory, currentPeriod);
        charts.renderAllocationChart(holdings);

        // 요약 테이블
        renderDashboardTable(holdings);
    }

    function renderDashboardTable(holdings) {
        const tbody = document.querySelector('#dashboard-holdings-table tbody');

        if (holdings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>보유 종목이 없습니다</p><p class="sub">"거래 추가" 메뉴에서 첫 거래를 등록하세요</p></td></tr>';
            return;
        }

        tbody.innerHTML = holdings.map(h => {
            const pnlClass = h.pnlPercent >= 0 ? 'positive' : 'negative';
            const pnlSign = h.pnlPercent >= 0 ? '+' : '';
            return `
                <tr>
                    <td><strong>${h.ticker}</strong> <span style="color:var(--text-muted)">${h.name}</span></td>
                    <td>${formatNumber(h.quantity, 4)}</td>
                    <td>${formatPrice(h.avgPrice, h.currency)}</td>
                    <td>${formatPrice(h.currentPrice, h.currency)}</td>
                    <td>${formatPrice(h.currentValue, h.currency)}</td>
                    <td class="${pnlClass}">${pnlSign}${h.pnlPercent.toFixed(2)}%</td>
                </tr>
            `;
        }).join('');
    }

    // ── 보유 종목 페이지 ───────────────────────
    function refreshHoldings() {
        const holdings = portfolio.getHoldings();
        const tbody = document.querySelector('#holdings-table tbody');

        if (holdings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty-state"><p>보유 종목이 없습니다</p></td></tr>';
            return;
        }

        tbody.innerHTML = holdings.map(h => {
            const pnlClass = h.pnl >= 0 ? 'positive' : 'negative';
            const pnlSign = h.pnl >= 0 ? '+' : '';
            return `
                <tr>
                    <td><strong>${h.ticker}</strong></td>
                    <td>${h.name}</td>
                    <td>${formatNumber(h.quantity, 4)}</td>
                    <td>${formatPrice(h.avgPrice, h.currency)}</td>
                    <td>${formatPrice(h.currentPrice, h.currency)}</td>
                    <td>${formatPrice(h.currentValue, h.currency)}</td>
                    <td>${formatPrice(h.totalCost, h.currency)}</td>
                    <td class="${pnlClass}">${pnlSign}${formatPrice(Math.abs(h.pnl), h.currency)}</td>
                    <td class="${pnlClass}">${pnlSign}${h.pnlPercent.toFixed(2)}%</td>
                    <td>${h.weight.toFixed(1)}%</td>
                    <td>
                        <button class="btn-icon" onclick="editPrice('${h.ticker}', ${h.currentPrice}, '${h.currency}')" title="현재가 수정">&#9998;</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ── 거래 내역 페이지 ───────────────────────
    function refreshTransactions() {
        const filterTicker = document.getElementById('filter-ticker').value;
        const filterType = document.getElementById('filter-type').value;

        const txs = portfolio.getTransactions({
            ticker: filterTicker || undefined,
            type: filterType || undefined
        });

        const tbody = document.querySelector('#transactions-table tbody');

        if (txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state"><p>거래 내역이 없습니다</p></td></tr>';
            return;
        }

        tbody.innerHTML = txs.map(tx => {
            const typeTag = tx.type === 'buy'
                ? '<span class="tag-buy">매수</span>'
                : '<span class="tag-sell">매도</span>';
            const total = (tx.quantity * tx.price) + tx.fee;
            const currSymbol = tx.currency === 'KRW' ? '₩' : '$';

            return `
                <tr>
                    <td>${tx.date}</td>
                    <td>${typeTag}</td>
                    <td><strong>${tx.ticker}</strong></td>
                    <td>${tx.name}</td>
                    <td>${formatNumber(tx.quantity, 4)}</td>
                    <td>${currSymbol}${formatNumber(tx.price)}</td>
                    <td>${currSymbol}${formatNumber(tx.fee)}</td>
                    <td>${currSymbol}${formatNumber(total)}</td>
                    <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${tx.memo || ''}">${tx.memo || '-'}</td>
                    <td>
                        <button class="btn-icon" onclick="openEditTxModal('${tx.id}')" title="수정">&#9998;</button>
                        <button class="btn-icon delete" onclick="deleteTx('${tx.id}')" title="삭제">&#10005;</button>
                    </td>
                </tr>
            `;
        }).join('');

        // 필터 셀렉트 업데이트
        updateTickerFilter();
    }

    function updateTickerFilter() {
        const select = document.getElementById('filter-ticker');
        const current = select.value;
        const tickers = portfolio.getUniqueTickers();

        // 기존 옵션 제거 (첫 번째 "전체" 제외)
        while (select.options.length > 1) {
            select.remove(1);
        }

        tickers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (t === current) opt.selected = true;
            select.appendChild(opt);
        });
    }

    // ── 거래 추가 폼 ──────────────────────────
    function initTransactionForm() {
        const form = document.getElementById('transaction-form');
        const qtyInput = document.getElementById('tx-quantity');
        const priceInput = document.getElementById('tx-price');
        const feeInput = document.getElementById('tx-fee');

        // 총 금액 자동 계산
        function updateTotal() {
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            const fee = parseFloat(feeInput.value) || 0;
            const currency = document.getElementById('tx-currency').value;
            const total = (qty * price) + fee;
            const symbol = currency === 'KRW' ? '₩' : '$';
            document.getElementById('tx-total').value = symbol + formatNumber(total);
        }

        qtyInput.addEventListener('input', updateTotal);
        priceInput.addEventListener('input', updateTotal);
        feeInput.addEventListener('input', updateTotal);
        document.getElementById('tx-currency').addEventListener('change', updateTotal);

        // 폼 제출
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const tx = {
                type: document.getElementById('tx-type').value,
                date: document.getElementById('tx-date').value,
                ticker: document.getElementById('tx-ticker').value,
                name: document.getElementById('tx-name').value,
                quantity: document.getElementById('tx-quantity').value,
                price: document.getElementById('tx-price').value,
                fee: document.getElementById('tx-fee').value,
                currency: document.getElementById('tx-currency').value,
                memo: document.getElementById('tx-memo').value
            };

            // 매도 시 보유수량 확인
            if (tx.type === 'sell') {
                const holdings = portfolio.getHoldings();
                const holding = holdings.find(h => h.ticker === tx.ticker.toUpperCase().trim());
                if (!holding || holding.quantity < parseFloat(tx.quantity)) {
                    showToast('매도 수량이 보유 수량을 초과합니다', 'error');
                    return;
                }
            }

            portfolio.addTransaction(tx);
            showToast('거래가 등록되었습니다', 'success');

            form.reset();
            setDefaultDate();
            document.getElementById('tx-total').value = '';

            // 대시보드로 이동
            navigateTo('dashboard');
        });
    }

    function setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('tx-date').value = today;
    }

    // ── 필터 ───────────────────────────────────
    function initFilters() {
        document.getElementById('filter-ticker').addEventListener('change', refreshTransactions);
        document.getElementById('filter-type').addEventListener('change', refreshTransactions);
    }

    // ── 차트 기간 선택 ─────────────────────────
    function initChartPeriod() {
        document.querySelectorAll('.chart-period').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.chart-period').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentPeriod = this.dataset.period;

                const navHistory = portfolio.calculateNAVHistory();
                charts.renderNAVChart(navHistory, currentPeriod);
            });
        });
    }

    // ── 모달 ───────────────────────────────────
    function initModals() {
        // 모든 모달 닫기 버튼
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('.modal').style.display = 'none';
            });
        });

        // 배경 클릭으로 닫기
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.style.display = 'none';
                }
            });
        });

        // 현재가 일괄 업데이트 버튼
        document.getElementById('btn-update-prices').addEventListener('click', openPriceModal);
        document.getElementById('btn-save-prices').addEventListener('click', savePrices);

        // 거래 수정 저장
        document.getElementById('btn-save-edit-tx').addEventListener('click', saveEditTx);
    }

    function openPriceModal() {
        const holdings = portfolio.getHoldings();
        const container = document.getElementById('price-update-form');

        if (holdings.length === 0) {
            showToast('업데이트할 보유 종목이 없습니다', 'info');
            return;
        }

        container.innerHTML = `
            <div class="price-update-item" style="border-bottom: 2px solid var(--border); padding-bottom: 12px; margin-bottom: 8px;">
                <span class="ticker-label" style="color: var(--text-muted); font-weight: normal;">USD/KRW 환율</span>
                <input type="number" id="modal-exchange-rate" step="0.01" value="${portfolio.getExchangeRate()}" placeholder="환율">
            </div>
        ` + holdings.map(h => `
            <div class="price-update-item">
                <span class="ticker-label">${h.ticker}</span>
                <input type="number" step="0.01" data-ticker="${h.ticker}" data-currency="${h.currency}"
                       value="${h.currentPrice}" placeholder="현재가 (${h.currency})">
                <span style="color:var(--text-muted);font-size:0.8rem">${h.currency}</span>
            </div>
        `).join('');

        document.getElementById('modal-price').style.display = 'flex';
    }

    function savePrices() {
        // 환율 저장
        const rateInput = document.getElementById('modal-exchange-rate');
        if (rateInput && rateInput.value) {
            portfolio.setExchangeRate(rateInput.value);
        }

        // 각 종목 현재가 저장
        document.querySelectorAll('#price-update-form input[data-ticker]').forEach(input => {
            const ticker = input.dataset.ticker;
            const currency = input.dataset.currency;
            const price = parseFloat(input.value);
            if (!isNaN(price) && price > 0) {
                portfolio.updateCurrentPrice(ticker, price, currency);
            }
        });

        document.getElementById('modal-price').style.display = 'none';
        showToast('현재가가 업데이트되었습니다', 'success');
        refreshAll();
    }

    // ── 거래 수정/삭제 ─────────────────────────
    window.openEditTxModal = function(txId) {
        const tx = portfolio.data.transactions.find(t => t.id === txId);
        if (!tx) return;

        document.getElementById('edit-tx-id').value = tx.id;
        document.getElementById('edit-tx-type').value = tx.type;
        document.getElementById('edit-tx-date').value = tx.date;
        document.getElementById('edit-tx-ticker').value = tx.ticker;
        document.getElementById('edit-tx-name').value = tx.name;
        document.getElementById('edit-tx-currency').value = tx.currency || 'USD';
        document.getElementById('edit-tx-quantity').value = tx.quantity;
        document.getElementById('edit-tx-price').value = tx.price;
        document.getElementById('edit-tx-fee').value = tx.fee;
        document.getElementById('edit-tx-memo').value = tx.memo || '';

        document.getElementById('modal-edit-tx').style.display = 'flex';
    };

    function saveEditTx() {
        const id = document.getElementById('edit-tx-id').value;
        const updates = {
            type: document.getElementById('edit-tx-type').value,
            date: document.getElementById('edit-tx-date').value,
            ticker: document.getElementById('edit-tx-ticker').value,
            name: document.getElementById('edit-tx-name').value,
            currency: document.getElementById('edit-tx-currency').value,
            quantity: document.getElementById('edit-tx-quantity').value,
            price: document.getElementById('edit-tx-price').value,
            fee: document.getElementById('edit-tx-fee').value,
            memo: document.getElementById('edit-tx-memo').value
        };

        portfolio.updateTransaction(id, updates);
        document.getElementById('modal-edit-tx').style.display = 'none';
        showToast('거래가 수정되었습니다', 'success');
        refreshAll();
    }

    window.deleteTx = function(txId) {
        if (confirm('이 거래를 삭제하시겠습니까?')) {
            portfolio.deleteTransaction(txId);
            showToast('거래가 삭제되었습니다', 'success');
            refreshAll();
        }
    };

    window.editPrice = function(ticker, currentPrice, currency) {
        const newPrice = prompt(`${ticker} 현재가 입력 (${currency}):`, currentPrice);
        if (newPrice !== null && !isNaN(parseFloat(newPrice))) {
            portfolio.updateCurrentPrice(ticker, parseFloat(newPrice), currency);
            showToast(`${ticker} 현재가가 업데이트되었습니다`, 'success');
            refreshAll();
        }
    };

    // ── 데이터 내보내기/가져오기 ───────────────
    function initExportImport() {
        document.getElementById('btn-export').addEventListener('click', function() {
            const data = portfolio.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'portfolio_' + new Date().toISOString().split('T')[0] + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('데이터가 내보내기 되었습니다', 'success');
        });

        document.getElementById('btn-import').addEventListener('click', function() {
            document.getElementById('file-import').click();
        });

        document.getElementById('file-import').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(ev) {
                const success = portfolio.importData(ev.target.result);
                if (success) {
                    showToast('데이터를 성공적으로 가져왔습니다', 'success');
                    refreshAll();
                } else {
                    showToast('유효하지 않은 데이터 파일입니다', 'error');
                }
            };
            reader.readAsText(file);
            e.target.value = ''; // 같은 파일 재선택 허용
        });
    }

    // ── 전체 새로고침 ──────────────────────────
    function refreshAll() {
        if (currentPage === 'dashboard') refreshDashboard();
        else if (currentPage === 'holdings') refreshHoldings();
        else if (currentPage === 'transactions') refreshTransactions();
    }

    // ── 토스트 알림 ────────────────────────────
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3000);
    }

})();
