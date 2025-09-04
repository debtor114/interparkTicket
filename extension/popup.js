// Extension Popup 스크립트
console.log('🎫 티켓팅 모니터 Popup 로드됨');

class PopupController {
    constructor() {
        this.isMonitoring = false;
        this.stats = {
            totalRequests: 0,
            importantRequests: 0,
            lastActivity: null
        };
        this.activityLog = [];
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.loadCurrentState();
        this.startStatusUpdater();
    }

    // DOM 요소 설정
    setupElements() {
        this.elements = {
            monitoringStatus: document.getElementById('monitoring-status'),
            currentSite: document.getElementById('current-site'),
            loginStatus: document.getElementById('login-status'),
            
            toggleMonitoringBtn: document.getElementById('toggle-monitoring'),
            viewAnalysisBtn: document.getElementById('view-analysis'),
            exportBtn: document.getElementById('export-data'),
            
            totalRequests: document.getElementById('total-requests'),
            importantRequests: document.getElementById('important-requests'),
            lastActivity: document.getElementById('last-activity'),
            activityLog: document.getElementById('activity-log')
        };

        // 필수 요소들이 존재하는지 확인
        const requiredElements = ['toggleMonitoringBtn', 'viewAnalysisBtn', 'exportBtn'];
        for (const elementName of requiredElements) {
            if (!this.elements[elementName]) {
                console.error(`필수 요소 ${elementName}을 찾을 수 없습니다`);
                this.addLogEntry(`오류: UI 요소 ${elementName} 누락`, true);
            }
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        if (this.elements.toggleMonitoringBtn) {
            this.elements.toggleMonitoringBtn.addEventListener('click', () => this.toggleMonitoring());
        }
        if (this.elements.viewAnalysisBtn) {
            this.elements.viewAnalysisBtn.addEventListener('click', () => this.viewAnalysis());
        }
        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => this.dataManagement());
        }
    }

    // 안전한 요소 업데이트
    safeUpdateElement(elementKey, property, value) {
        try {
            if (!this.elements[elementKey]) {
                console.warn(`요소 ${elementKey}가 존재하지 않습니다`);
                return false;
            }
            
            // disabled 속성의 경우 boolean 처리
            if (property === 'disabled') {
                this.elements[elementKey].disabled = Boolean(value);
            } else {
                this.elements[elementKey][property] = value;
            }
            return true;
        } catch (error) {
            console.error(`요소 ${elementKey} 업데이트 오류:`, error);
            return false;
        }
    }

    // 현재 상태 로드
    async loadCurrentState() {
        try {
            // 현재 활성 탭 확인
            const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
            this.updateCurrentSite(activeTab?.url);

            // Background script로부터 상태 정보 요청
            chrome.runtime.sendMessage({type: 'GET_REQUESTS'}, (response) => {
                if (response && response.requests) {
                    this.updateStats(response.requests);
                }
            });

            // 저장된 상태 로드
            const result = await chrome.storage.local.get(['isMonitoring', 'stats', 'activityLog', 'isExtensionEnabled']);
            if (result.isMonitoring) {
                this.isMonitoring = result.isMonitoring;
                this.updateMonitoringUI();
            }
            if (result.stats) {
                this.stats = result.stats;
                this.updateStatsUI();
            }
            if (result.activityLog) {
                this.activityLog = result.activityLog.slice(-10); // 최근 10개만 유지
                this.updateActivityLog();
            }
            // 확장 프로그램은 항상 활성화 상태
            await chrome.storage.local.set({ isExtensionEnabled: true });
            chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION', isEnabled: true });

        } catch (error) {
            console.error('상태 로드 오류:', error);
            this.addLogEntry('오류: 상태 로드 실패', true);
        }
    }

    // 상태 업데이터 시작 (실시간 업데이트)
    startStatusUpdater() {
        setInterval(async () => {
            await this.refreshStatus();
        }, 2000);
    }

    // 상태 새로고침
    async refreshStatus() {
        try {
            // 현재 탭 정보 업데이트
            const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
            this.updateCurrentSite(activeTab?.url);

            // Content script에서 로그인 상태 확인
            if (activeTab && this.isTicketingSite(activeTab.url)) {
                chrome.tabs.sendMessage(activeTab.id, {type: 'GET_LOGIN_STATUS'}, (response) => {
                    if (response) {
                        this.updateLoginStatus(response);
                    }
                });
            }

        } catch (error) {
            console.error('상태 새로고침 오류:', error);
        }
    }

    // 모니터링 토글 (시작/중지 통합)
    async toggleMonitoring() {
        try {
            if (!this.elements.toggleMonitoringBtn) {
                console.error('toggleMonitoringBtn 요소를 찾을 수 없습니다');
                this.addLogEntry('오류: UI 요소 참조 실패', true);
                return;
            }

            if (this.isMonitoring) {
                // 중지
                chrome.runtime.sendMessage({type: 'STOP_MONITORING'}, (response) => {
                    if (response && response.success) {
                        this.isMonitoring = false;
                        this.updateToggleButton();
                        if (this.elements.monitoringStatus) {
                            this.elements.monitoringStatus.textContent = '준비';
                        }
                        this.saveState();
                        this.addLogEntry('DOM 분석이 중지되었습니다.');
                    }
                });
            } else {
                // 시작
                chrome.runtime.sendMessage({type: 'START_MONITORING'}, (response) => {
                    if (response && response.success) {
                        this.isMonitoring = true;
                        this.stats.lastActivity = new Date().toLocaleTimeString();
                        this.updateToggleButton();
                        if (this.elements.monitoringStatus) {
                            this.elements.monitoringStatus.textContent = '실행 중';
                        }
                        this.saveState();
                        this.addLogEntry('DOM 분석이 시작되었습니다.');
                    }
                });
            }
        } catch (error) {
            console.error('모니터링 토글 오류:', error);
            this.addLogEntry('오류: 분석 상태 변경 실패', true);
        }
    }

    // 토글 버튼 상태 업데이트
    updateToggleButton() {
        if (!this.elements.toggleMonitoringBtn) {
            console.warn('toggleMonitoringBtn 요소가 없습니다');
            return;
        }
        
        try {
            if (this.isMonitoring) {
                this.elements.toggleMonitoringBtn.textContent = '분석 중지';
                this.elements.toggleMonitoringBtn.className = 'btn btn-danger';
            } else {
                this.elements.toggleMonitoringBtn.textContent = '분석 시작';
                this.elements.toggleMonitoringBtn.className = 'btn btn-primary';
            }
        } catch (error) {
            console.error('토글 버튼 업데이트 오류:', error);
        }
    }


    // 현재 사이트 업데이트
    updateCurrentSite(url) {
        try {
            if (!url) {
                this.safeUpdateElement('currentSite', 'textContent', '-');
                return;
            }

            if (url.includes('interpark.com')) {
                this.safeUpdateElement('currentSite', 'textContent', '인터파크');
                this.safeUpdateElement('currentSite', 'className', 'status-value online');
            } else if (url.includes('ticketlink.co.kr')) {
                this.safeUpdateElement('currentSite', 'textContent', '티켓링크');
                this.safeUpdateElement('currentSite', 'className', 'status-value online');
            } else {
                this.safeUpdateElement('currentSite', 'textContent', '기타');
                this.safeUpdateElement('currentSite', 'className', 'status-value offline');
            }

            // 로그인 상태도 안전하게 업데이트
            this.safeUpdateElement('loginStatus', 'textContent', '확인 중');
        } catch (error) {
            console.error('사이트 정보 업데이트 오류:', error);
            this.safeUpdateElement('currentSite', 'textContent', '오류');
        }
    }

    // 로그인 상태 업데이트
    updateLoginStatus(loginInfo) {
        if (loginInfo.isLoggedIn) {
            this.elements.loginStatus.textContent = '로그인됨';
            this.elements.loginStatus.className = 'status-value online';
        } else {
            this.elements.loginStatus.textContent = '로그인 필요';
            this.elements.loginStatus.className = 'status-value offline';
        }
    }

    // 모니터링 UI 업데이트
    updateMonitoringUI() {
        if (this.isMonitoring) {
            this.elements.monitoringStatus.textContent = '모니터링 중';
            this.elements.monitoringStatus.className = 'status-value monitoring';
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
        } else {
            this.elements.monitoringStatus.textContent = '중지됨';
            this.elements.monitoringStatus.className = 'status-value offline';
            this.elements.startBtn.disabled = false;
            this.elements.stopBtn.disabled = true;
        }
    }

    // 통계 업데이트
    updateStats(requests) {
        this.stats.totalRequests = requests.length;
        this.stats.importantRequests = requests.filter(req => 
            req.type === 'BOOKING' || req.type === 'PAYMENT' || req.type === 'SEAT'
        ).length;
        
        if (requests.length > 0) {
            const lastRequest = requests[requests.length - 1];
            this.stats.lastActivity = new Date(lastRequest.timestamp).toLocaleTimeString();
        }
        
        this.updateStatsUI();
    }

    // 통계 UI 업데이트
    updateStatsUI() {
        this.elements.totalRequests.textContent = this.stats.totalRequests;
        this.elements.importantRequests.textContent = this.stats.importantRequests;
        this.elements.lastActivity.textContent = this.stats.lastActivity || '-';
    }

    // 활동 로그 추가
    addLogEntry(message, isError = false) {
        const entry = {
            timestamp: new Date().toLocaleTimeString(),
            message: message,
            isError: isError
        };
        
        this.activityLog.unshift(entry);
        this.activityLog = this.activityLog.slice(0, 10); // 최근 10개만 유지
        
        this.updateActivityLog();
        this.saveState();
    }

    // 활동 로그 UI 업데이트
    updateActivityLog() {
        this.elements.activityLog.innerHTML = '';
        
        this.activityLog.forEach(entry => {
            const logItem = document.createElement('div');
            logItem.className = `log-item ${entry.isError ? 'important' : ''}`;
            logItem.innerHTML = `
                <div class="log-time">${entry.timestamp}</div>
                <div>${entry.message}</div>
            `;
            this.elements.activityLog.appendChild(logItem);
        });
    }

    // 요청 내역 모달 표시
    showRequestsModal(requests) {
        const modalContent = requests.map(req => `
            <div><strong>${req.type}</strong> - ${req.url}</div>
            <div>시간: ${new Date(req.timestamp).toLocaleString()}</div>
            <div>상태: ${req.statusCode || 'pending'}</div>
            <hr>
        `).join('');
        
        alert(`요청 내역 (${requests.length}개)\n\n${modalContent.replace(/<[^>]*>/g, '')}`);
    }


    // 통합 분석 결과 보기 (DOM 분석 + 네트워크 요청)
    async viewAnalysis() {
        // DOM 분석과 네트워크 요청을 모두 포함한 통합 분석 결과
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const siteKey = this.getSiteKey(tab.url);
            
            // DOM 분석 데이터 가져오기
            const domResult = await chrome.storage.local.get([
                `latest_analysis_${siteKey}`,
                `selector_patterns_${siteKey}`,
                `electron_data_${siteKey}`
            ]);
            
            // 네트워크 요청 데이터 가져오기
            const networkResponse = await chrome.runtime.sendMessage({ type: 'GET_REQUESTS' });
            const eventsResponse = await chrome.runtime.sendMessage({ type: 'GET_EVENTS' });
            
            const analysisData = domResult[`latest_analysis_${siteKey}`];
            const networkRequests = networkResponse.requests || [];
            const userEvents = eventsResponse.events || [];

            this.displayIntegratedAnalysis({
                domAnalysis: analysisData,
                networkRequests: networkRequests,
                userEvents: userEvents,
                selectorPatterns: domResult[`selector_patterns_${siteKey}`],
                electronData: domResult[`electron_data_${siteKey}`]
            });
            
        } catch (error) {
            console.error('통합 분석 결과 조회 오류:', error);
            this.addLogEntry('분석 결과를 가져올 수 없습니다.');
        }
    }

    // DOM 분석 결과 보기 (이전 메서드명 유지)
    async viewDOMAnalysis() {
        try {
            // 현재 활성 탭 정보 가져오기
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const siteKey = this.getSiteKey(tab.url);
            
            // 최신 DOM 분석 결과 가져오기
            const result = await chrome.storage.local.get([
                `latest_analysis_${siteKey}`,
                `selector_patterns_${siteKey}`,
                `electron_data_${siteKey}`
            ]);
            
            const analysisData = result[`latest_analysis_${siteKey}`];
            const selectorPatterns = result[`selector_patterns_${siteKey}`];
            const electronData = result[`electron_data_${siteKey}`];
            
            if (!analysisData) {
                this.addLogEntry('DOM 분석 결과가 없습니다. 잠시 후 다시 시도해주세요.');
                return;
            }
            
            this.displayDOMAnalysisResults(analysisData, selectorPatterns, electronData);
            
        } catch (error) {
            console.error('DOM 분석 결과 조회 오류:', error);
            this.addLogEntry('DOM 분석 결과를 가져올 수 없습니다.');
        }
    }

    // DOM 분석 결과 표시
    displayDOMAnalysisResults(analysisData, selectorPatterns, electronData) {
        const elements = analysisData.elements;
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>DOM 분석 결과 - ${analysisData.site}</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; margin: 20px; line-height: 1.6; }
                    .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                    .site-info { margin-bottom: 20px; }
                    .element-section { margin-bottom: 30px; }
                    .element-title { color: #495057; font-size: 18px; font-weight: 600; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px; }
                    .element-item { background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-bottom: 12px; }
                    .element-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px; }
                    .meta-item { font-size: 12px; }
                    .meta-label { font-weight: 600; color: #6c757d; }
                    .meta-value { color: #495057; word-break: break-all; }
                    .xpath { background: #f8f9fa; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px; margin-top: 8px; }
                    .confidence { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
                    .confidence-high { background: #d4edda; color: #155724; }
                    .confidence-medium { background: #fff3cd; color: #856404; }
                    .confidence-low { background: #f8d7da; color: #721c24; }
                    .no-elements { text-align: center; color: #6c757d; font-style: italic; padding: 20px; }
                    .summary { background: #e7f3ff; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
                    .automation-script { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin-top: 20px; }
                    .automation-title { font-weight: 600; margin-bottom: 10px; color: #495057; }
                    .action-item { background: white; border-left: 4px solid #007bff; padding: 10px; margin-bottom: 8px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔍 DOM 분석 결과</h1>
                    <div class="site-info">
                        <p><strong>사이트:</strong> ${analysisData.site}</p>
                        <p><strong>URL:</strong> ${analysisData.url}</p>
                        <p><strong>분석 시간:</strong> ${new Date(analysisData.timestamp).toLocaleString('ko-KR')}</p>
                    </div>
                </div>

                <div class="summary">
                    <h3>📊 분석 요약</h3>
                    <ul>
                        <li>예약 버튼: ${elements.reservationButtons?.length || 0}개</li>
                        <li>좌석 선택: ${elements.seatSelectors?.length || 0}개</li>
                        <li>가격 정보: ${elements.priceElements?.length || 0}개</li>
                        <li>날짜 선택: ${elements.dateSelectors?.length || 0}개</li>
                        <li>수량 선택: ${elements.quantitySelectors?.length || 0}개</li>
                        <li>결제 버튼: ${elements.paymentButtons?.length || 0}개</li>
                        <li>로그인 요소: ${elements.loginElements?.length || 0}개</li>
                    </ul>
                </div>
        `;

        // 각 요소 타입별로 결과 표시
        const elementTypes = [
            { key: 'reservationButtons', title: '🎫 예약/예매 버튼', icon: '🎫' },
            { key: 'seatSelectors', title: '💺 좌석 선택 요소', icon: '💺' },
            { key: 'priceElements', title: '💰 가격 정보 요소', icon: '💰' },
            { key: 'dateSelectors', title: '📅 날짜 선택 요소', icon: '📅' },
            { key: 'quantitySelectors', title: '🔢 수량 선택 요소', icon: '🔢' },
            { key: 'paymentButtons', title: '💳 결제 버튼', icon: '💳' },
            { key: 'loginElements', title: '🔐 로그인 요소', icon: '🔐' }
        ];

        elementTypes.forEach(({ key, title }) => {
            const elementList = elements[key] || [];
            
            htmlContent += `
                <div class="element-section">
                    <div class="element-title">${title} (${elementList.length}개)</div>
            `;

            if (elementList.length === 0) {
                htmlContent += `<div class="no-elements">발견된 요소가 없습니다.</div>`;
            } else {
                elementList.forEach((element, index) => {
                    const confidence = this.calculateDisplayConfidence(element, key);
                    const confidenceClass = confidence > 0.7 ? 'confidence-high' : 
                                          confidence > 0.4 ? 'confidence-medium' : 'confidence-low';
                    
                    htmlContent += `
                        <div class="element-item">
                            <div class="element-meta">
                                <div class="meta-item">
                                    <div class="meta-label">태그:</div>
                                    <div class="meta-value">${element.tag}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="meta-label">텍스트:</div>
                                    <div class="meta-value">${element.text || '(텍스트 없음)'}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="meta-label">ID:</div>
                                    <div class="meta-value">${element.id || '(ID 없음)'}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="meta-label">클래스:</div>
                                    <div class="meta-value">${element.className || '(클래스 없음)'}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="meta-label">가시성:</div>
                                    <div class="meta-value">${element.visible ? '✅ 보임' : '❌ 숨김'}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="meta-label">신뢰도:</div>
                                    <div class="meta-value">
                                        <span class="confidence ${confidenceClass}">
                                            ${Math.round(confidence * 100)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="xpath">
                                <strong>XPath:</strong> ${element.xpath}
                            </div>
                        </div>
                    `;
                });
            }

            htmlContent += `</div>`;
        });

        // 자동화 스크립트 정보 추가
        if (electronData && electronData.automationScript) {
            htmlContent += `
                <div class="automation-script">
                    <div class="automation-title">🤖 생성된 자동화 스크립트</div>
                    <p><strong>대상 사이트:</strong> ${electronData.automationScript.site}</p>
                    <div style="margin-top: 15px;">
                        <strong>실행 순서:</strong>
            `;

            electronData.automationScript.actions.forEach((action, index) => {
                htmlContent += `
                    <div class="action-item">
                        <strong>${index + 1}.</strong> ${action.description}
                        <br><small>선택자: ${action.selector || '(선택자 없음)'}</small>
                    </div>
                `;
            });

            htmlContent += `</div></div>`;
        }

        htmlContent += `</body></html>`;

        // 새 창에서 결과 표시
        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        
        this.addLogEntry('DOM 분석 결과를 새 창에서 열었습니다.');
    }

    // 통합 분석 결과 표시
    displayIntegratedAnalysis(data) {
        const { domAnalysis, networkRequests, userEvents, electronData } = data;
        
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>통합 분석 결과</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; margin: 20px; line-height: 1.6; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                    .section { background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 8px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
                    .stat-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; text-align: center; }
                    .stat-number { font-size: 24px; font-weight: 700; color: #007bff; }
                    .stat-label { font-size: 12px; color: #6c757d; margin-top: 5px; }
                    .network-item { background: #f8f9fa; border-left: 4px solid #007bff; padding: 10px; margin-bottom: 8px; font-family: monospace; font-size: 12px; }
                    .event-item { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin-bottom: 8px; }
                    .no-data { text-align: center; color: #6c757d; font-style: italic; padding: 20px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔍 통합 분석 결과</h1>
                    <p>DOM 요소 분석 + 네트워크 모니터링 + 사용자 이벤트</p>
                </div>
        `;

        // 요약 통계
        const domElementsCount = domAnalysis ? Object.values(domAnalysis.elements).reduce((sum, arr) => sum + arr.length, 0) : 0;
        htmlContent += `
            <div class="section">
                <div class="section-title">📊 요약 통계</div>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${domElementsCount}</div>
                        <div class="stat-label">DOM 요소</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${networkRequests.length}</div>
                        <div class="stat-label">네트워크 요청</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${userEvents.length}</div>
                        <div class="stat-label">사용자 이벤트</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${electronData?.automationScript?.actions?.length || 0}</div>
                        <div class="stat-label">자동화 액션</div>
                    </div>
                </div>
            </div>
        `;

        // DOM 분석 결과 (간략)
        if (domAnalysis) {
            htmlContent += `
                <div class="section">
                    <div class="section-title">🎯 주요 DOM 요소</div>
            `;
            
            const keyElements = ['reservationButtons', 'seatSelectors', 'paymentButtons'];
            keyElements.forEach(elementType => {
                const elements = domAnalysis.elements[elementType] || [];
                const label = {
                    reservationButtons: '예약 버튼',
                    seatSelectors: '좌석 선택',
                    paymentButtons: '결제 버튼'
                }[elementType];
                
                if (elements.length > 0) {
                    htmlContent += `<p><strong>${label}:</strong> ${elements.length}개 발견</p>`;
                }
            });
            
            htmlContent += `</div>`;
        }

        // 최근 네트워크 요청
        if (networkRequests.length > 0) {
            htmlContent += `
                <div class="section">
                    <div class="section-title">🌐 최근 네트워크 요청 (최대 10개)</div>
            `;
            
            networkRequests.slice(-10).forEach(request => {
                htmlContent += `
                    <div class="network-item">
                        <strong>${request.method || 'GET'}</strong> ${request.url}
                        <br><small>시간: ${new Date(request.timestamp).toLocaleTimeString()}</small>
                    </div>
                `;
            });
            
            htmlContent += `</div>`;
        }

        htmlContent += `</body></html>`;

        // 새 창에서 결과 표시
        const newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        
        this.addLogEntry('통합 분석 결과를 새 창에서 열었습니다.');
    }

    // 데이터 관리 (이전의 viewRequests + exportData 통합)
    async dataManagement() {
        try {
            // 현재 탭 분석 결과를 JSON으로 다운로드
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !this.isTicketingSite(tab.url)) {
                this.addLogEntry('인터파크 사이트에서만 분석 가능합니다.', true);
                return;
            }

            // Content script에 분석 요청
            chrome.tabs.sendMessage(tab.id, { type: 'EXPORT_ANALYSIS' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('분석 요청 실패:', chrome.runtime.lastError.message);
                    this.addLogEntry('페이지 분석 실패. 새로고침 후 다시 시도해주세요.', true);
                } else {
                    this.addLogEntry('분석 결과를 JSON 파일로 다운로드했습니다.');
                    console.log('✅ 분석 결과 다운로드 완료');
                }
            });

        } catch (error) {
            console.error('데이터 관리 오류:', error);
            this.addLogEntry('분석 중 오류가 발생했습니다.', true);
        }
    }

    // 데이터 관리 창 표시
    showDataManagementWindow(data) {
        const { networkRequests, userEvents, domAnalysis, selectorPatterns } = data;
        
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>데이터 관리</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; margin: 20px; }
                    .header { background: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                    .action-section { background: white; border: 1px solid #dee2e6; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
                    .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
                    .btn-primary { background: #007bff; color: white; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-warning { background: #ffc107; color: #212529; }
                    .data-preview { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 4px; max-height: 200px; overflow-y: auto; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📁 데이터 관리</h1>
                    <p>수집된 데이터를 확인하고 내보내기</p>
                </div>

                <div class="action-section">
                    <h3>내보내기 옵션</h3>
                    <button class="btn btn-primary" onclick="exportNetworkData()">네트워크 요청 내보내기</button>
                    <button class="btn btn-success" onclick="exportDOMData()">DOM 분석 데이터 내보내기</button>
                    <button class="btn btn-warning" onclick="exportAllData()">전체 데이터 내보내기</button>
                </div>

                <div class="action-section">
                    <h3>네트워크 요청 (${networkRequests.length}개)</h3>
                    <div class="data-preview">
                        ${networkRequests.slice(0, 10).map(req => `
                            <div>${req.method || 'GET'} ${req.url} - ${new Date(req.timestamp).toLocaleTimeString()}</div>
                        `).join('')}
                        ${networkRequests.length > 10 ? '<div>... 더 많은 데이터</div>' : ''}
                    </div>
                </div>

                <div class="action-section">
                    <h3>DOM 요소 분석</h3>
                    <div class="data-preview">
                        ${domAnalysis ? `
                            <div>예약 버튼: ${domAnalysis.elements.reservationButtons?.length || 0}개</div>
                            <div>좌석 선택: ${domAnalysis.elements.seatSelectors?.length || 0}개</div>
                            <div>결제 버튼: ${domAnalysis.elements.paymentButtons?.length || 0}개</div>
                        ` : '<div>DOM 분석 데이터가 없습니다.</div>'}
                    </div>
                </div>

                <script>
                    function exportNetworkData() {
                        const data = ${JSON.stringify(networkRequests)};
                        downloadJSON(data, 'network-requests.json');
                    }

                    function exportDOMData() {
                        const data = ${JSON.stringify(domAnalysis)};
                        downloadJSON(data, 'dom-analysis.json');
                    }

                    function exportAllData() {
                        const data = {
                            networkRequests: ${JSON.stringify(networkRequests)},
                            userEvents: ${JSON.stringify(userEvents)},
                            domAnalysis: ${JSON.stringify(domAnalysis)},
                            exportTime: new Date().toISOString()
                        };
                        downloadJSON(data, 'ticketing-data-export.json');
                    }

                    function downloadJSON(data, filename) {
                        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                </script>
            </body>
            </html>
        `;

        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
        newWindow.document.write(htmlContent);
        newWindow.document.close();
        
        this.addLogEntry('데이터 관리 창을 열었습니다.');
    }

    // 표시용 신뢰도 계산
    calculateDisplayConfidence(element, elementType) {
        let confidence = 0.5;

        if (element.visible) confidence += 0.2;
        if (element.onclick || (element.styles && element.styles.cursor === 'pointer')) {
            confidence += 0.2;
        }

        const text = (element.text || '').toLowerCase();
        const relevantKeywords = this.getRelevantKeywords(elementType);
        const matchCount = relevantKeywords.filter(keyword => text.includes(keyword)).length;
        confidence += Math.min(matchCount * 0.1, 0.3);

        return Math.min(confidence, 1.0);
    }

    // 요소 타입별 관련 키워드
    getRelevantKeywords(elementType) {
        const keywords = {
            reservationButtons: ['예매', '예약', '구매', 'book', 'reserve', 'buy'],
            seatSelectors: ['좌석', 'seat', 'chair'],
            priceElements: ['원', 'price', 'cost', 'fee'],
            dateSelectors: ['날짜', 'date', 'calendar'],
            quantitySelectors: ['수량', 'qty', 'quantity', 'count'],
            paymentButtons: ['결제', 'payment', 'pay', 'checkout'],
            loginElements: ['로그인', 'login', 'id', 'password']
        };
        return keywords[elementType] || [];
    }

    // 사이트 키 생성
    getSiteKey(url) {
        if (!url) return 'unknown';
        const hostname = new URL(url).hostname;
        return hostname.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }


    // 티켓팅 사이트 확인
    isTicketingSite(url) {
        if (!url) return false;
        return url.includes('interpark.com') || url.includes('ticketlink.co.kr');
    }

    // 상태 저장
    async saveState() {
        try {
            await chrome.storage.local.set({
                isMonitoring: this.isMonitoring,
                stats: this.stats,
                activityLog: this.activityLog
            });
        } catch (error) {
            console.error('상태 저장 오류:', error);
        }
    }
}

// Popup 로드 시 컨트롤러 초기화
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});