/**
 * 포트폴리오 트래커 - 차트 모듈
 * Chart.js를 사용한 NAV 그래프, 자산 배분 차트
 */

class ChartManager {
    constructor() {
        this.navChart = null;
        this.allocationChart = null;
        this.chartColors = [
            '#4f8cff', '#00d68f', '#ff5c5c', '#ffc107',
            '#a855f7', '#f97316', '#06b6d4', '#ec4899',
            '#84cc16', '#6366f1', '#14b8a6', '#f43f5e'
        ];
    }

    // ── NAV 차트 ──────────────────────────────
    renderNAVChart(navHistory, period = 'all') {
        const canvas = document.getElementById('chart-nav');
        if (!canvas) return;

        // 기간 필터링
        const filtered = this.filterByPeriod(navHistory, period);

        if (filtered.length === 0) {
            this.destroyChart('nav');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#6b7185';
            ctx.font = '14px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('거래를 추가하면 그래프가 표시됩니다', canvas.width / 2, canvas.height / 2);
            return;
        }

        const labels = filtered.map(d => d.date);
        const values = filtered.map(d => d.value);
        const costs = filtered.map(d => d.cost);

        // 최소/최대 범위 계산
        const allValues = [...values, ...costs];
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const padding = (max - min) * 0.1 || max * 0.05;

        this.destroyChart('nav');

        this.navChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: '평가금액 (₩)',
                        data: values,
                        borderColor: '#4f8cff',
                        backgroundColor: 'rgba(79, 140, 255, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: filtered.length > 60 ? 0 : 3,
                        pointHoverRadius: 5,
                        borderWidth: 2
                    },
                    {
                        label: '투자원금 (₩)',
                        data: costs,
                        borderColor: '#6b7185',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#9aa0b2',
                            font: { size: 11 },
                            usePointStyle: true,
                            pointStyleWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e2130',
                        titleColor: '#e8eaed',
                        bodyColor: '#9aa0b2',
                        borderColor: '#2a2e42',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                const val = context.parsed.y;
                                return context.dataset.label + ': ' + formatKRW(val);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: this.getTimeUnit(filtered.length),
                            displayFormats: {
                                day: 'MM/dd',
                                week: 'MM/dd',
                                month: 'yyyy/MM'
                            }
                        },
                        grid: {
                            color: 'rgba(42, 46, 66, 0.5)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7185',
                            font: { size: 10 },
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        min: Math.max(0, min - padding),
                        max: max + padding,
                        grid: {
                            color: 'rgba(42, 46, 66, 0.5)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7185',
                            font: { size: 10 },
                            callback: function(val) {
                                return formatCompactKRW(val);
                            }
                        }
                    }
                }
            }
        });
    }

    // ── 자산 배분 차트 ─────────────────────────
    renderAllocationChart(holdings) {
        const canvas = document.getElementById('chart-allocation');
        if (!canvas) return;

        this.destroyChart('allocation');

        if (holdings.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#6b7185';
            ctx.font = '14px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('보유 종목이 없습니다', canvas.width / 2, canvas.height / 2);
            return;
        }

        const labels = holdings.map(h => h.ticker);
        const data = holdings.map(h => h.weight);
        const colors = holdings.map((_, i) => this.chartColors[i % this.chartColors.length]);

        this.allocationChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderColor: '#1e2130',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#9aa0b2',
                            font: { size: 11 },
                            padding: 12,
                            usePointStyle: true,
                            pointStyleWidth: 8
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e2130',
                        titleColor: '#e8eaed',
                        bodyColor: '#9aa0b2',
                        borderColor: '#2a2e42',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // ── 유틸리티 ───────────────────────────────
    filterByPeriod(data, period) {
        if (period === 'all' || !data.length) return data;

        const now = new Date();
        let cutoff;

        switch (period) {
            case '1m':
                cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
            case '3m':
                cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                break;
            case '6m':
                cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
                break;
            case '1y':
                cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                break;
            default:
                return data;
        }

        const cutoffStr = cutoff.toISOString().split('T')[0];
        return data.filter(d => d.date >= cutoffStr);
    }

    getTimeUnit(dataPoints) {
        if (dataPoints > 365) return 'month';
        if (dataPoints > 90) return 'week';
        return 'day';
    }

    destroyChart(type) {
        if (type === 'nav' && this.navChart) {
            this.navChart.destroy();
            this.navChart = null;
        }
        if (type === 'allocation' && this.allocationChart) {
            this.allocationChart.destroy();
            this.allocationChart = null;
        }
    }

    destroyAll() {
        this.destroyChart('nav');
        this.destroyChart('allocation');
    }
}

// ── 금액 포맷 유틸리티 ─────────────────────────
function formatKRW(amount) {
    if (amount === 0) return '₩0';
    return '₩' + Math.round(amount).toLocaleString('ko-KR');
}

function formatUSD(amount) {
    if (amount === 0) return '$0';
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompactKRW(amount) {
    if (Math.abs(amount) >= 100000000) {
        return (amount / 100000000).toFixed(1) + '억';
    }
    if (Math.abs(amount) >= 10000) {
        return (amount / 10000).toFixed(0) + '만';
    }
    return Math.round(amount).toLocaleString();
}

function formatNumber(num, decimals = 2) {
    return parseFloat(num).toLocaleString('ko-KR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatPrice(price, currency) {
    if (currency === 'KRW') return formatKRW(price);
    return formatUSD(price);
}

// 전역 인스턴스
const charts = new ChartManager();
