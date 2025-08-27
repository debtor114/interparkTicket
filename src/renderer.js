const { ipcRenderer, shell } = require('electron');
const puppeteer = require('puppeteer');

class TicketingApp {
    constructor() {
        this.isRunning = false;
        this.browser = null;
        this.page = null;
        this.loginCheckInterval = null;
        this.isLoggedIn = false;
        this.loggedInUserName = null;
        this.actionLog = []; // 사용자 행동 기록
        this.isRecording = false;
        this.learnedPatterns = {}; // 학습된 패턴들
        this.initializeEventListeners();
        this.loadSettings();
    }

    initializeEventListeners() {
        // 브라우저 열기 버튼
        document.getElementById('openBrowserBtn').addEventListener('click', (e) => {
            console.log('브라우저 열기 버튼 클릭됨');
            e.preventDefault();
            e.stopPropagation();
            this.openTicketingSite();
        });

        // 로그인 확인 버튼
        document.getElementById('checkLoginBtn').addEventListener('click', () => {
            this.manualLoginCheck();
        });

        // 콘서트 선택 변경
        document.getElementById('concertSelect').addEventListener('change', (e) => {
            this.handleConcertSelection(e.target.value);
        });

        // 시작 버튼
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startTicketing();
        });

        // 중지 버튼
        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stopTicketing();
        });

        // 행동 기록 버튼
        document.getElementById('recordBtn').addEventListener('click', () => {
            if (this.isRecording) {
                this.stopActionRecording();
                document.getElementById('recordBtn').textContent = '행동 기록';
                document.getElementById('saveLogBtn').disabled = false;
            } else {
                this.setupActionRecording();
                document.getElementById('recordBtn').textContent = '기록 중지';
            }
        });

        // 로그 저장 버튼
        document.getElementById('saveLogBtn').addEventListener('click', () => {
            this.saveActionLog();
        });

        // 패턴 학습 버튼
        document.getElementById('learnBtn')?.addEventListener('click', () => {
            this.analyzeAndLearnPatterns();
        });

        // 설정 값들 저장
        const settings = ['ticketCount', 'seatGrade', 'autoRefresh'];
        settings.forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.saveSettings();
            });
        });
    }

    async openTicketingSite() {
        const concertSelect = document.getElementById('concertSelect').value;
        let url = '';

        switch(concertSelect) {
            case 'concert1':
                url = 'https://nol.interpark.com/';
                break;
            case 'concert2':
                url = 'https://tickets.melon.com/';
                break;
            case 'concert3':
                url = 'https://ticket.yes24.com/';
                break;
            case 'custom':
                url = document.getElementById('concertUrl').value;
                break;
            default:
                url = 'https://nol.interpark.com/';
        }

        if (!url) {
            this.addLog('URL을 입력하세요', 'error');
            return;
        }

        try {
            // 버튼 비활성화
            document.getElementById('openBrowserBtn').disabled = true;
            document.getElementById('openBrowserBtn').textContent = '브라우저 열기 중...';

            this.addLog('내장 브라우저를 시작하고 있습니다...');

            // Puppeteer 브라우저 시작 (봇 감지 우회 설정)
            this.browser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: [
                    '--start-maximized',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-extensions',
                    '--no-first-run',
                    '--disable-default-apps'
                ]
            });

            this.page = await this.browser.newPage();
            
            // 봇 감지 우회 설정
            await this.page.evaluateOnNewDocument(() => {
                // webdriver 속성 제거
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // plugins 배열 추가
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                
                // languages 설정
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['ko-KR', 'ko', 'en-US', 'en'],
                });
                
                // Chrome 객체 추가
                window.chrome = {
                    runtime: {}
                };
                
                // permissions API 수정
                if (window.navigator.permissions) {
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: 'granted' }) :
                            originalQuery(parameters)
                    );
                }
            });
            
            // 사용자 에이전트 설정
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // 콘솔 메시지 필터링
            this.page.on('console', msg => {
                const text = msg.text();
                // 중요하지 않은 경고들 필터링
                if (text.includes('ViewContent format will be deprecated') || 
                    text.includes('Unrecognized feature') ||
                    text.includes('Third-party cookie')) {
                    return; // 무시
                }
                console.log('페이지 콘솔:', text);
            });

            // 사용자 행동 기록 기능 활성화
            await this.setupActionRecording();
            
            await this.page.goto(url, { waitUntil: 'networkidle2' });
            
            // 상태 업데이트
            document.getElementById('loginStatus').textContent = '브라우저에서 로그인하세요';
            document.getElementById('loginStatus').className = 'status';
            
            this.addLog(`티케팅 사이트 열림: ${url}`);
            
            // 로그인 확인 버튼 활성화
            document.getElementById('checkLoginBtn').disabled = false;
            
            // 행동 기록 버튼 활성화
            document.getElementById('recordBtn').disabled = false;
            
            // 로그인 상태 자동 감지 시작
            this.startLoginCheck();
            
            this.updateStartButtonState();

        } catch (error) {
            this.addLog(`브라우저 열기 실패: ${error.message}`, 'error');
            
            // 버튼 복원
            document.getElementById('openBrowserBtn').disabled = false;
            document.getElementById('openBrowserBtn').textContent = '티케팅 사이트 열기';
        }
    }

    handleConcertSelection(value) {
        const customDiv = document.getElementById('customConcert');
        if (value === 'custom') {
            customDiv.style.display = 'block';
        } else {
            customDiv.style.display = 'none';
        }
        this.updateStartButtonState();
    }

    updateStartButtonState() {
        const concertSelected = document.getElementById('concertSelect').value !== '';
        const startBtn = document.getElementById('startBtn');
        
        if (concertSelected && this.isLoggedIn && !this.isRunning) {
            startBtn.disabled = false;
        } else {
            startBtn.disabled = true;
        }
    }

    startLoginCheck() {
        if (this.loginCheckInterval) {
            clearInterval(this.loginCheckInterval);
        }

        this.addLog('로그인 상태 확인을 시작합니다...');
        
        this.loginCheckInterval = setInterval(async () => {
            try {
                const isLoggedIn = await this.checkInterparkLogin();
                if (isLoggedIn && !this.isLoggedIn) {
                    this.isLoggedIn = true;
                    this.onLoginDetected();
                } else if (!isLoggedIn && this.isLoggedIn) {
                    this.isLoggedIn = false;
                    this.onLogoutDetected();
                }
            } catch (error) {
                // 로그인 확인 실패는 조용히 처리
            }
        }, 3000); // 3초마다 확인
    }

    async checkInterparkLogin() {
        if (!this.page) {
            return false;
        }

        try {
            // 실제 인터파크 로그인 상태 확인
            const loginStatus = await this.page.evaluate(() => {
                // 로그인된 사용자명이 포함된 메뉴 찾기
                const userMenu = document.querySelector('._my-menu-root_1xzlz_1');
                if (userMenu) {
                    const userNameElement = userMenu.querySelector('li');
                    if (userNameElement && userNameElement.textContent.includes('님')) {
                        return {
                            isLoggedIn: true,
                            userName: userNameElement.textContent.trim()
                        };
                    }
                }

                // 다른 패턴들도 확인
                const userNameElements = document.querySelectorAll('li');
                for (let element of userNameElements) {
                    if (element.textContent && element.textContent.includes('님') && 
                        element.textContent.match(/[가-힣a-zA-Z0-9]+님/)) {
                        return {
                            isLoggedIn: true,
                            userName: element.textContent.trim()
                        };
                    }
                }

                return { isLoggedIn: false, userName: null };
            });

            if (loginStatus.isLoggedIn) {
                this.loggedInUserName = loginStatus.userName;
                return true;
            }

            return false;
        } catch (error) {
            console.error('인터파크 로그인 확인 실패:', error);
            return false;
        }
    }

    onLoginDetected() {
        const userName = this.loggedInUserName || '사용자님';
        
        document.getElementById('loginStatus').textContent = `${userName} 환영합니다`;
        document.getElementById('loginStatus').className = 'status connected';
        
        // 로그인 확인 버튼 비활성화 및 텍스트 변경
        document.getElementById('checkLoginBtn').disabled = true;
        document.getElementById('checkLoginBtn').textContent = '로그인 완료';
        
        this.addLog(`✅ ${userName} 인터파크 로그인이 감지되었습니다!`, 'success');
        this.updateStartButtonState();
        
        // 로그인 확인을 중지
        if (this.loginCheckInterval) {
            clearInterval(this.loginCheckInterval);
            this.loginCheckInterval = null;
        }
    }

    onLogoutDetected() {
        document.getElementById('loginStatus').textContent = '로그인하지 않음';
        document.getElementById('loginStatus').className = 'status';
        
        this.addLog('❌ 로그아웃되었습니다', 'warning');
        this.updateStartButtonState();
        
        // 다시 로그인 확인 시작
        this.startLoginCheck();
    }

    async manualLoginCheck() {
        document.getElementById('checkLoginBtn').disabled = true;
        document.getElementById('checkLoginBtn').textContent = '확인 중...';
        
        this.addLog('로그인 상태를 확인하고 있습니다...');
        
        try {
            const isLoggedIn = await this.checkInterparkLogin();
            if (isLoggedIn) {
                this.isLoggedIn = true;
                this.onLoginDetected();
            } else {
                this.addLog('❌ 로그인이 감지되지 않았습니다. 브라우저에서 로그인을 완료해주세요.', 'warning');
                document.getElementById('checkLoginBtn').disabled = false;
                document.getElementById('checkLoginBtn').textContent = '로그인 확인';
            }
        } catch (error) {
            this.addLog('로그인 확인 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
            document.getElementById('checkLoginBtn').disabled = false;
            document.getElementById('checkLoginBtn').textContent = '로그인 확인';
        }
    }

    async startTicketing() {
        if (this.isRunning) return;

        this.isRunning = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;

        const config = this.getTicketingConfig();
        this.addLog('티케팅을 시작합니다...', 'success');
        this.addLog(`설정: ${config.ticketCount}매, ${config.seatGrade} 등급`);

        try {
            // 실제 티케팅 로직 실행
            await this.runTicketingLoop(config);
        } catch (error) {
            this.addLog(`에러 발생: ${error.message}`, 'error');
        }
    }

    stopTicketing() {
        this.isRunning = false;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        this.addLog('티케팅이 중지되었습니다', 'warning');
        this.updateStartButtonState();
    }

    async closeBrowser() {
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                this.addLog('브라우저가 종료되었습니다');
            } catch (error) {
                console.error('브라우저 종료 오류:', error);
            }
        }
    }

    async runTicketingLoop(config) {
        const refreshInterval = parseInt(config.autoRefresh);
        
        while (this.isRunning) {
            try {
                this.addLog('티케팅 페이지 확인 중...');
                
                // 현재 페이지 URL 확인
                const currentUrl = await this.page.url();
                this.addLog(`현재 페이지: ${currentUrl}`);
                
                // 먼저 보안 팝업 처리
                await this.handleSecurityPopup();
                
                // 대기열 감지 및 처리
                await this.handleWaitingQueue();
                
                // 페이지 유형에 따라 다른 로직 실행
                if (currentUrl.includes('goods') || currentUrl.includes('ticket')) {
                    // 티케팅 메인 페이지
                    const bookingResult = await this.tryBooking(config);
                    if (bookingResult.success) {
                        this.addLog('예매하기 버튼 클릭 성공!', 'success');
                        await this.sleep(2000);
                        continue;
                    }
                } else if (currentUrl.includes('seat') || currentUrl.includes('booking')) {
                    // 좌석 선택 페이지
                    const seatResult = await this.selectSeats(config);
                    if (seatResult.success) {
                        this.addLog('좌석 선택 완료!', 'success');
                        await this.sleep(2000);
                        continue;
                    }
                } else if (currentUrl.includes('payment') || currentUrl.includes('order')) {
                    // 결제 페이지 도달
                    this.addLog('🎉 결제 페이지에 도달했습니다! 수동으로 결제를 완료하세요.', 'success');
                    this.stopTicketing();
                    break;
                }
                
                // 페이지 새로고침
                await this.page.reload({ waitUntil: 'networkidle2' });
                await this.sleep(refreshInterval);
                
            } catch (error) {
                this.addLog(`티케팅 중 오류: ${error.message}`, 'error');
                await this.sleep(5000);
            }
        }
    }

    async tryBooking(config) {
        try {
            // 1단계: 관람일 선택
            const dateSelected = await this.selectDate();
            if (!dateSelected) {
                this.addLog('사용 가능한 관람일을 찾는 중...', 'warning');
                return { success: false, reason: '관람일 선택 실패' };
            }

            // 잠시 대기
            await this.sleep(1000);

            // 2단계: 회차 선택
            const timeSelected = await this.selectTime();
            if (!timeSelected) {
                this.addLog('사용 가능한 회차를 찾는 중...', 'warning');
                return { success: false, reason: '회차 선택 실패' };
            }

            // 잠시 대기
            await this.sleep(1000);

            // 3단계: 안심예매하기 버튼 클릭
            const bookingClicked = await this.clickBookingButton();
            if (!bookingClicked) {
                return { success: false, reason: '예매하기 버튼을 찾을 수 없음' };
            }

            return { success: true };
        } catch (error) {
            return { success: false, reason: error.message };
        }
    }

    async selectDate() {
        try {
            // 관람일 선택 - 다양한 패턴 시도
            const dateSelectors = [
                '.calendar-day:not(.disabled)',
                '.date-item:not(.disabled)',
                '[class*="date"]:not([class*="disabled"])',
                '.available-date',
                'button[data-date]',
                '.calendar button:not(:disabled)'
            ];

            for (const selector of dateSelectors) {
                try {
                    const dates = await this.page.$$(selector);
                    if (dates.length > 0) {
                        // 첫 번째 사용 가능한 날짜 선택
                        await this.humanClick(dates[0]);
                        this.addLog('관람일 선택 완료');
                        return true;
                    }
                } catch (e) {
                    // 다음 선택자 시도
                }
            }

            // XPath로도 시도
            const dateElements = await this.page.$x('//button[not(contains(@class, "disabled")) and (contains(@class, "date") or contains(@class, "day"))]');
            if (dateElements.length > 0) {
                await this.humanClick(dateElements[0]);
                this.addLog('관람일 선택 완료');
                return true;
            }

            return false;
        } catch (error) {
            console.error('관람일 선택 오류:', error);
            return false;
        }
    }

    async selectTime() {
        try {
            // 회차 선택 - 다양한 패턴 시도
            const timeSelectors = [
                '.time-item:not(.disabled)',
                '.session:not(.disabled)',
                '[class*="time"]:not([class*="disabled"])',
                '.available-time',
                'button[data-time]',
                '.showtime button:not(:disabled)'
            ];

            for (const selector of timeSelectors) {
                try {
                    const times = await this.page.$$(selector);
                    if (times.length > 0) {
                        // 첫 번째 사용 가능한 회차 선택
                        await this.humanClick(times[0]);
                        this.addLog('회차 선택 완료');
                        return true;
                    }
                } catch (e) {
                    // 다음 선택자 시도
                }
            }

            // XPath로도 시도 (시간이나 회차 관련 텍스트)
            const timeElements = await this.page.$x('//button[not(contains(@class, "disabled")) and (contains(text(), "시") or contains(text(), "회") or contains(@class, "time"))]');
            if (timeElements.length > 0) {
                await this.humanClick(timeElements[0]);
                this.addLog('회차 선택 완료');
                return true;
            }

            return false;
        } catch (error) {
            console.error('회차 선택 오류:', error);
            return false;
        }
    }

    async clickBookingButton() {
        try {
            // 인터파크 실제 구조에 맞는 선택자 사용
            const bookingSelectors = [
                'a.sideBtn.is-primary',  // 정확한 클래스 구조
                'a[class*="sideBtn"][class*="is-primary"]',  // 클래스 포함 검색
                '.sideBtnWrap a.sideBtn:first-child'  // 첫 번째 sideBtn
            ];

            let element = null;

            // CSS 선택자로 찾기
            for (const selector of bookingSelectors) {
                try {
                    element = await this.page.$(selector);
                    if (element) {
                        const isVisible = await element.isIntersectingViewport();
                        if (isVisible) {
                            break;
                        } else {
                            element = null;
                        }
                    }
                } catch (e) {
                    // 다음 선택자 시도
                }
            }

            // XPath로도 시도 (span 안의 텍스트 기반)
            if (!element) {
                const xpathElements = await this.page.$x(`//a[contains(@class, 'sideBtn') and contains(@class, 'is-primary')]//span[contains(text(), '예매하기')]/../..`);
                if (xpathElements.length > 0) {
                    element = xpathElements[0];
                }
            }

            // 더 간단한 XPath
            if (!element) {
                const simpleXpath = await this.page.$x(`//a[@class='sideBtn is-primary']`);
                if (simpleXpath.length > 0) {
                    element = simpleXpath[0];
                }
            }

            if (element) {
                const isVisible = await element.isIntersectingViewport();
                if (isVisible) {
                    // data-check 속성 확인
                    const dataCheck = await this.page.evaluate(el => el.getAttribute('data-check'), element);
                    this.addLog(`예매하기 버튼 발견 (data-check: ${dataCheck})`);

                    // 새 창 열림 감지 준비
                    const currentPages = await this.browser.pages();
                    const currentPageCount = currentPages.length;
                    
                    // 여러 클릭 방법 시도
                    let clicked = await this.humanClick(element);
                    if (!clicked) {
                        clicked = await this.dispatchNativeClick(element);
                    }
                    if (!clicked) {
                        await element.click(); // 마지막 수단
                    }
                    
                    this.addLog('예매하기 버튼 클릭!', 'success');
                    
                    // 새 창이 열렸는지 확인 (최대 5초 대기)
                    let newPageDetected = false;
                    for (let i = 0; i < 50; i++) {
                        const newPages = await this.browser.pages();
                        if (newPages.length > currentPageCount) {
                            // 새 창이 열렸음
                            const newPage = newPages[newPages.length - 1]; // 가장 최근 창
                            this.page = newPage; // 작업 페이지를 새 창으로 변경
                            
                            // 새 창이 로드될 때까지 대기
                            await this.page.waitForLoadState?.('networkidle') || await this.sleep(2000);
                            
                            const newUrl = await this.page.url();
                            this.addLog(`새 창 감지됨: ${newUrl}`, 'success');
                            newPageDetected = true;
                            break;
                        }
                        await this.sleep(100); // 0.1초 대기
                    }
                    
                    if (!newPageDetected) {
                        // 새 창이 안 열렸으면 현재 페이지 URL 변경 확인
                        await this.sleep(2000);
                        const newUrl = await this.page.url();
                        this.addLog(`페이지 이동됨: ${newUrl}`, 'success');
                    }
                    
                    return true;
                }
            }
            
            this.addLog('예매하기 버튼을 찾을 수 없습니다', 'warning');
            return false;
        } catch (error) {
            console.error('예매 버튼 클릭 오류:', error);
            return false;
        }
    }

    async selectSeats(config) {
        try {
            const { ticketCount, seatGrade } = config;
            
            // 먼저 좌석 등급 선택
            if (seatGrade !== 'any') {
                await this.selectSeatGrade(seatGrade);
            }
            
            // 매수 선택
            await this.selectTicketCount(ticketCount);
            
            // 좌석 선택
            const seatSelected = await this.autoSelectSeats(parseInt(ticketCount));
            if (!seatSelected) {
                return { success: false, reason: '좌석 선택 실패' };
            }
            
            // 다음 단계 버튼 클릭
            const nextStep = await this.clickNextButton();
            return { success: nextStep };
            
        } catch (error) {
            return { success: false, reason: error.message };
        }
    }

    async selectSeatGrade(grade) {
        try {
            const gradeMap = {
                'vip': ['VIP', 'vip', 'V석', 'V'],
                'r': ['R석', 'R', 'R석', 'ROYAL'],
                's': ['S석', 'S', 'STANDARD'],
                'a': ['A석', 'A', 'ADVANCE']
            };
            
            const gradeTexts = gradeMap[grade] || [grade];
            
            for (const gradeText of gradeTexts) {
                const buttons = await this.page.$x(`//button[contains(text(), '${gradeText}')]`);
                if (buttons.length > 0) {
                    await this.humanClick(buttons[0]);
                    this.addLog(`${gradeText} 등급 선택`);
                    await this.sleep(1000);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('좌석 등급 선택 오류:', error);
            return false;
        }
    }

    async selectTicketCount(count) {
        try {
            // 매수 선택 드롭다운 찾기
            const selects = await this.page.$$('select');
            for (const select of selects) {
                const options = await select.$$('option');
                for (const option of options) {
                    const text = await option.evaluate(el => el.textContent);
                    if (text.includes(count) || text.includes(`${count}매`)) {
                        await option.click();
                        this.addLog(`${count}매 선택`);
                        return true;
                    }
                }
            }
            
            return false;
        } catch (error) {
            console.error('매수 선택 오류:', error);
            return false;
        }
    }

    async autoSelectSeats(count) {
        try {
            // 사용 가능한 좌석 찾기
            const seatSelectors = [
                '.seat.available',
                '.seat:not(.disabled)',
                '[class*="seat"]:not([class*="disabled"])',
                '[data-available="true"]',
                'button[class*="seat"]:not(:disabled)'
            ];
            
            let selectedCount = 0;
            
            for (const selector of seatSelectors) {
                if (selectedCount >= count) break;
                
                try {
                    const seats = await this.page.$$(selector);
                    for (const seat of seats) {
                        if (selectedCount >= count) break;
                        
                        const isVisible = await seat.isIntersectingViewport();
                        if (isVisible) {
                            await this.humanClick(seat);
                            selectedCount++;
                            this.addLog(`좌석 ${selectedCount} 선택`);
                            await this.sleep(500);
                        }
                    }
                } catch (e) {
                    // 다음 선택자 시도
                }
            }
            
            return selectedCount > 0;
        } catch (error) {
            console.error('좌석 자동 선택 오류:', error);
            return false;
        }
    }

    async clickNextButton() {
        try {
            const nextButtons = await this.page.$x(`//button[contains(text(), '다음') or contains(text(), '선택완료') or contains(text(), '확인') or contains(text(), '결제')]`);
            
            if (nextButtons.length > 0) {
                await this.humanClick(nextButtons[0]);
                this.addLog('다음 단계로 진행');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('다음 버튼 클릭 오류:', error);
            return false;
        }
    }

    getTicketingConfig() {
        const concertSelect = document.getElementById('concertSelect');
        const concertUrl = document.getElementById('concertUrl');
        const concertName = document.getElementById('concertName');
        
        return {
            concert: concertSelect.value === 'custom' 
                ? concertName.value 
                : concertSelect.options[concertSelect.selectedIndex].text,
            url: concertSelect.value === 'custom' 
                ? concertUrl.value 
                : this.getDefaultUrl(concertSelect.value),
            ticketCount: document.getElementById('ticketCount').value,
            seatGrade: document.getElementById('seatGrade').value,
            autoRefresh: document.getElementById('autoRefresh').value
        };
    }

    getDefaultUrl(concertKey) {
        const urls = {
            'concert1': 'https://nol.interpark.com/',
            'concert2': 'https://tickets.melon.com/',
            'concert3': 'https://ticket.yes24.com/'
        };
        return urls[concertKey] || '';
    }

    addLog(message, type = 'info') {
        const statusLog = document.getElementById('statusLog');
        const logItem = document.createElement('div');
        logItem.className = `log-item ${type}`;
        
        const now = new Date().toLocaleTimeString();
        logItem.textContent = `[${now}] ${message}`;
        
        statusLog.appendChild(logItem);
        statusLog.scrollTop = statusLog.scrollHeight;

        // 로그가 너무 많아지면 오래된 것 삭제
        if (statusLog.children.length > 100) {
            statusLog.removeChild(statusLog.firstChild);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async humanClick(element) {
        try {
            // 요소가 화면에 보이는지 확인
            await element.scrollIntoView();
            await this.sleep(100 + Math.random() * 100);
            
            // 요소의 위치 가져오기
            const box = await element.boundingBox();
            if (!box) return false;
            
            // 요소 중앙에서 약간 랜덤한 위치 클릭
            const x = box.x + box.width / 2 + (Math.random() - 0.5) * 10;
            const y = box.y + box.height / 2 + (Math.random() - 0.5) * 10;
            
            // 자연스러운 마우스 움직임과 클릭
            await this.page.mouse.move(x, y, { steps: Math.floor(Math.random() * 3) + 1 });
            await this.sleep(50 + Math.random() * 50);
            
            // 마우스다운, 잠깐 대기, 마우스업 (더 자연스러운 클릭)
            await this.page.mouse.down();
            await this.sleep(20 + Math.random() * 30);
            await this.page.mouse.up();
            
            // 클릭 후 약간 대기
            await this.sleep(100 + Math.random() * 100);
            
            return true;
        } catch (error) {
            console.error('Human click 오류:', error);
            return false;
        }
    }

    async dispatchNativeClick(element) {
        try {
            // JavaScript 이벤트 직접 발생
            await this.page.evaluate((el) => {
                // 실제 브라우저 이벤트 생성
                const events = ['mousedown', 'mouseup', 'click'];
                
                events.forEach(eventType => {
                    const event = new MouseEvent(eventType, {
                        bubbles: true,
                        cancelable: true,
                        clientX: Math.floor(Math.random() * 10) + 50,
                        clientY: Math.floor(Math.random() * 10) + 50,
                        button: 0,
                        buttons: 1
                    });
                    
                    el.dispatchEvent(event);
                });
                
                // focus 이벤트도 추가
                if (el.focus) {
                    el.focus();
                }
            }, element);
            
            return true;
        } catch (error) {
            console.error('Native click 오류:', error);
            return false;
        }
    }

    async handleSecurityPopup() {
        try {
            // "잠깐 접어두기" 링크 찾기 - 다양한 패턴 시도
            
            // XPath로 텍스트 기반 검색 (가장 확실한 방법)
            const xpathElements = await this.page.$x(`//a[contains(text(), '잠깐 접어두기') or contains(text(), '접어두기') or contains(text(), '닫기')]`);
            
            for (const element of xpathElements) {
                try {
                    const isVisible = await element.isIntersectingViewport();
                    if (isVisible) {
                        const text = await this.page.evaluate(el => el.textContent, element);
                        this.addLog(`팝업 닫기 링크 발견: "${text}"`);
                        
                        await this.humanClick(element);
                        this.addLog('잠깐 접어두기 클릭함', 'success');
                        await this.sleep(1000); // 팝업이 닫힐 시간을 줌
                        return true;
                    }
                } catch (e) {
                    // 다음 요소 시도
                }
            }

            // span이나 다른 요소 안에 있을 수도 있음
            const spanElements = await this.page.$x(`//span[contains(text(), '잠깐 접어두기') or contains(text(), '접어두기')]`);
            for (const element of spanElements) {
                try {
                    const isVisible = await element.isIntersectingViewport();
                    if (isVisible) {
                        // span의 부모 요소 클릭 (링크일 가능성)
                        const parent = await element.evaluateHandle(el => el.parentElement);
                        await this.humanClick(parent);
                        this.addLog('잠깐 접어두기 (부모 요소) 클릭함', 'success');
                        await this.sleep(1000);
                        return true;
                    }
                } catch (e) {
                    // 다음 요소 시도
                }
            }

            // CSS 선택자로도 시도
            const popupSelectors = [
                'a[href*="javascript"]',  // javascript 링크
                '.popup-close',           // 팝업 닫기 클래스
                '[onclick*="close"]',     // onclick에 close가 포함된 요소
                '[class*="close"]'        // close 관련 클래스
            ];

            for (const selector of popupSelectors) {
                try {
                    const elements = await this.page.$$(selector);
                    for (const element of elements) {
                        const text = await this.page.evaluate(el => el.textContent, element);
                        if (text.includes('잠깐') || text.includes('접어두기') || text.includes('닫기')) {
                            const isVisible = await element.isIntersectingViewport();
                            if (isVisible) {
                                await this.humanClick(element);
                                this.addLog(`팝업 닫기 (${text}) 클릭함`, 'success');
                                await this.sleep(1000);
                                return true;
                            }
                        }
                    }
                } catch (e) {
                    // 다음 선택자 시도
                }
            }

            return false;
        } catch (error) {
            console.error('보안 팝업 처리 오류:', error);
            return false;
        }
    }

    async setupActionRecording() {
        try {
            this.actionLog = [];
            this.isRecording = true;
            
            // 페이지에 이벤트 리스너 추가
            await this.page.evaluateOnNewDocument(() => {
                window.userActions = [];
                
                // 클릭 이벤트 기록
                document.addEventListener('click', (e) => {
                    const element = e.target;
                    const action = {
                        type: 'click',
                        timestamp: Date.now(),
                        selector: getSelector(element),
                        text: element.textContent?.trim() || '',
                        tagName: element.tagName,
                        className: element.className,
                        id: element.id,
                        url: window.location.href
                    };
                    
                    window.userActions.push(action);
                    console.log('🎯 클릭 기록:', action);
                });
                
                // 입력 이벤트 기록
                document.addEventListener('input', (e) => {
                    const element = e.target;
                    const action = {
                        type: 'input',
                        timestamp: Date.now(),
                        selector: getSelector(element),
                        value: element.value,
                        tagName: element.tagName,
                        name: element.name,
                        id: element.id,
                        url: window.location.href
                    };
                    
                    window.userActions.push(action);
                    console.log('⌨️ 입력 기록:', action);
                });
                
                // CSS 선택자 생성 함수
                function getSelector(element) {
                    if (element.id) {
                        return `#${element.id}`;
                    }
                    
                    if (element.className) {
                        const classes = element.className.split(' ').filter(c => c);
                        if (classes.length > 0) {
                            return `.${classes.join('.')}`;
                        }
                    }
                    
                    // 태그명 + 텍스트로 XPath 생성
                    const text = element.textContent?.trim();
                    if (text && text.length < 50) {
                        return `xpath:///${element.tagName.toLowerCase()}[contains(text(), '${text}')]`;
                    }
                    
                    return element.tagName.toLowerCase();
                }
            });
            
            // 주기적으로 기록된 액션 가져오기
            this.recordingInterval = setInterval(async () => {
                if (this.isRecording && this.page) {
                    try {
                        const newActions = await this.page.evaluate(() => {
                            const actions = window.userActions || [];
                            window.userActions = []; // 가져온 후 초기화
                            return actions;
                        });
                        
                        if (newActions.length > 0) {
                            this.actionLog.push(...newActions);
                            this.addLog(`📝 ${newActions.length}개 액션 기록됨`);
                            
                            // 중요한 액션들 로그에 표시
                            newActions.forEach(action => {
                                if (action.type === 'click' && (
                                    action.text.includes('예매') ||
                                    action.text.includes('좌석') ||
                                    action.text.includes('선택') ||
                                    action.text.includes('확인') ||
                                    action.text.includes('결제')
                                )) {
                                    this.addLog(`🎯 중요 클릭: "${action.text}" (${action.selector})`, 'success');
                                }
                            });
                        }
                    } catch (e) {
                        // 페이지가 변경되거나 오류 발생 시 무시
                    }
                }
            }, 2000); // 2초마다 확인
            
            this.addLog('🎬 사용자 행동 기록 시작됨', 'success');
            
        } catch (error) {
            console.error('행동 기록 설정 오류:', error);
        }
    }

    stopActionRecording() {
        this.isRecording = false;
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
        }
        
        this.addLog(`🛑 행동 기록 중지 (총 ${this.actionLog.length}개 액션 기록됨)`, 'warning');
        return this.actionLog;
    }

    saveActionLog() {
        if (this.actionLog.length > 0) {
            const logData = {
                timestamp: new Date().toISOString(),
                totalActions: this.actionLog.length,
                actions: this.actionLog
            };
            
            const dataStr = JSON.stringify(logData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `ticketing_actions_${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.addLog('💾 행동 로그 파일 저장됨', 'success');
        }
    }

    async replayActions(actions) {
        if (!this.page || !actions || actions.length === 0) {
            this.addLog('재생할 액션이 없습니다', 'warning');
            return;
        }

        this.addLog(`🎬 ${actions.length}개 액션 재생 시작`, 'success');

        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            
            try {
                if (action.type === 'click') {
                    let element = null;
                    
                    // 선택자로 요소 찾기
                    if (action.selector.startsWith('xpath:')) {
                        const xpath = action.selector.replace('xpath:', '');
                        const elements = await this.page.$x(xpath);
                        element = elements[0];
                    } else if (action.selector.startsWith('#') || action.selector.startsWith('.')) {
                        element = await this.page.$(action.selector);
                    }
                    
                    if (element) {
                        await this.humanClick(element);
                        this.addLog(`▶️ 클릭 재생: "${action.text}"`);
                    } else {
                        this.addLog(`❌ 요소를 찾을 수 없음: ${action.selector}`, 'warning');
                    }
                    
                } else if (action.type === 'input') {
                    const element = await this.page.$(action.selector);
                    if (element) {
                        await element.type(action.value);
                        this.addLog(`⌨️ 입력 재생: "${action.value}"`);
                    }
                }
                
                // 액션 사이에 자연스러운 대기
                await this.sleep(1000 + Math.random() * 2000);
                
            } catch (error) {
                this.addLog(`❌ 액션 재생 실패 (${i+1}/${actions.length}): ${error.message}`, 'error');
            }
        }
        
        this.addLog('🎬 액션 재생 완료', 'success');
    }

    analyzeAndLearnPatterns() {
        if (this.actionLog.length === 0) {
            this.addLog('분석할 액션 로그가 없습니다', 'warning');
            return;
        }

        this.addLog('🧠 티케팅 패턴 분석 시작...', 'success');
        
        const patterns = {
            dateSelection: this.extractPattern(this.actionLog, ['날짜', '일', 'date', '관람일']),
            timeSelection: this.extractPattern(this.actionLog, ['시간', '시', 'time', '회차', 'session']),
            bookingButton: this.extractPattern(this.actionLog, ['예매', 'booking', '안심예매', 'book']),
            seatSelection: this.extractPattern(this.actionLog, ['좌석', 'seat', '선택', 'select']),
            gradeSelection: this.extractPattern(this.actionLog, ['등급', 'grade', 'VIP', 'R석', 'S석', 'A석']),
            confirmButton: this.extractPattern(this.actionLog, ['확인', 'confirm', '다음', 'next', '선택완료']),
            paymentButton: this.extractPattern(this.actionLog, ['결제', 'payment', 'pay', '주문'])
        };

        // 팝업 닫기 패턴
        patterns.popupClose = this.extractPattern(this.actionLog, ['접어두기', '닫기', 'close', '나중에']);

        // URL 패턴 분석
        patterns.urlFlow = this.analyzeUrlFlow(this.actionLog);

        // 타이밍 패턴 분석
        patterns.timing = this.analyzeTiming(this.actionLog);

        this.learnedPatterns = patterns;
        this.saveLearnedPatterns(patterns);
        
        this.addLog('🎓 패턴 학습 완료! 다른 공연에도 적용 가능합니다', 'success');
        this.logPatternSummary(patterns);
    }

    extractPattern(actions, keywords) {
        const matchedActions = actions.filter(action => {
            const text = action.text.toLowerCase();
            const selector = action.selector.toLowerCase();
            
            return keywords.some(keyword => 
                text.includes(keyword.toLowerCase()) || 
                selector.includes(keyword.toLowerCase())
            );
        });

        if (matchedActions.length === 0) return null;

        // 가장 일반화 가능한 선택자 찾기
        const selectors = matchedActions.map(action => action.selector);
        const generalizedSelector = this.generalizeSelector(selectors);

        return {
            count: matchedActions.length,
            selectors: [...new Set(selectors)],
            generalizedSelector,
            sampleAction: matchedActions[0],
            keywords: keywords.filter(k => 
                matchedActions.some(a => 
                    a.text.toLowerCase().includes(k.toLowerCase()) ||
                    a.selector.toLowerCase().includes(k.toLowerCase())
                )
            )
        };
    }

    generalizeSelector(selectors) {
        if (selectors.length === 0) return null;
        
        // 공통 클래스나 패턴 찾기
        const patterns = {
            hasClass: [],
            hasId: [],
            hasText: []
        };

        selectors.forEach(selector => {
            if (selector.includes('.')) {
                const classes = selector.split('.').filter(c => c);
                patterns.hasClass.push(...classes);
            }
            if (selector.includes('#')) {
                patterns.hasId.push(selector);
            }
            if (selector.startsWith('xpath:')) {
                patterns.hasText.push(selector);
            }
        });

        // 가장 빈번한 패턴 선택
        const mostCommonClass = this.getMostFrequent(patterns.hasClass);
        if (mostCommonClass) {
            return `[class*="${mostCommonClass}"]`;
        }

        // XPath 패턴이 있으면 텍스트 기반 선택 추천
        if (patterns.hasText.length > 0) {
            return 'text-based-xpath';
        }

        return selectors[0]; // 첫 번째 선택자 사용
    }

    getMostFrequent(arr) {
        if (arr.length === 0) return null;
        
        const frequency = {};
        let maxCount = 0;
        let mostFrequent = null;

        arr.forEach(item => {
            frequency[item] = (frequency[item] || 0) + 1;
            if (frequency[item] > maxCount) {
                maxCount = frequency[item];
                mostFrequent = item;
            }
        });

        return mostFrequent;
    }

    analyzeUrlFlow(actions) {
        const urlChanges = [];
        let lastUrl = '';

        actions.forEach(action => {
            if (action.url !== lastUrl) {
                urlChanges.push({
                    url: action.url,
                    timestamp: action.timestamp,
                    step: this.identifyUrlStep(action.url)
                });
                lastUrl = action.url;
            }
        });

        return urlChanges;
    }

    identifyUrlStep(url) {
        if (url.includes('goods') || url.includes('ticket')) return 'product_page';
        if (url.includes('seat') || url.includes('booking')) return 'seat_selection';
        if (url.includes('payment') || url.includes('order')) return 'payment';
        if (url.includes('confirm') || url.includes('complete')) return 'completion';
        return 'unknown';
    }

    analyzeTiming(actions) {
        const timings = [];
        
        for (let i = 1; i < actions.length; i++) {
            const delay = actions[i].timestamp - actions[i-1].timestamp;
            timings.push({
                delay: delay,
                beforeAction: actions[i-1].text,
                afterAction: actions[i].text
            });
        }

        const avgDelay = timings.reduce((sum, t) => sum + t.delay, 0) / timings.length;
        const minDelay = Math.min(...timings.map(t => t.delay));
        const maxDelay = Math.max(...timings.map(t => t.delay));

        return {
            averageDelay: Math.round(avgDelay),
            minDelay: Math.round(minDelay),
            maxDelay: Math.round(maxDelay),
            recommendedDelay: Math.round(avgDelay * 0.7) // 70% of average for faster execution
        };
    }

    saveLearnedPatterns(patterns) {
        const patternData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            source: 'user_recording',
            patterns: patterns
        };

        const dataStr = JSON.stringify(patternData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `learned_patterns_${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.addLog('💾 학습된 패턴 파일 저장됨', 'success');
    }

    logPatternSummary(patterns) {
        this.addLog('📋 학습된 패턴 요약:', 'info');
        
        Object.keys(patterns).forEach(key => {
            const pattern = patterns[key];
            if (pattern && pattern.count) {
                this.addLog(`  • ${key}: ${pattern.count}개 액션 (${pattern.keywords?.join(', ')})`, 'info');
            }
        });

        if (patterns.timing) {
            this.addLog(`  • 권장 대기시간: ${patterns.timing.recommendedDelay}ms`, 'info');
        }
    }

    async applyLearnedPatterns(patterns) {
        if (!patterns || !this.page) {
            this.addLog('적용할 패턴이 없습니다', 'warning');
            return;
        }

        this.addLog('🤖 학습된 패턴으로 자동 티케팅 시작', 'success');
        
        const delay = patterns.timing?.recommendedDelay || 2000;
        
        // 1. 팝업 닫기
        if (patterns.popupClose) {
            await this.applyPattern(patterns.popupClose, '팝업 닫기');
            await this.sleep(delay);
        }

        // 2. 날짜 선택
        if (patterns.dateSelection) {
            await this.applyPattern(patterns.dateSelection, '관람일 선택');
            await this.sleep(delay);
        }

        // 3. 시간 선택
        if (patterns.timeSelection) {
            await this.applyPattern(patterns.timeSelection, '회차 선택');
            await this.sleep(delay);
        }

        // 4. 예매하기 버튼
        if (patterns.bookingButton) {
            await this.applyPattern(patterns.bookingButton, '예매하기');
            await this.sleep(delay * 2); // 페이지 이동을 위해 더 긴 대기
        }

        // 5. 좌석 선택
        if (patterns.seatSelection) {
            await this.applyPattern(patterns.seatSelection, '좌석 선택');
            await this.sleep(delay);
        }

        // 6. 확인 버튼
        if (patterns.confirmButton) {
            await this.applyPattern(patterns.confirmButton, '선택 확인');
            await this.sleep(delay);
        }

        this.addLog('🎉 학습된 패턴 적용 완료!', 'success');
    }

    async applyPattern(pattern, stepName) {
        try {
            for (const selector of pattern.selectors) {
                let element = null;

                if (selector.startsWith('xpath:')) {
                    const xpath = selector.replace('xpath:', '');
                    const elements = await this.page.$x(xpath);
                    element = elements[0];
                } else if (selector === 'text-based-xpath') {
                    // 키워드 기반으로 XPath 생성
                    const keywords = pattern.keywords.join('|');
                    const xpath = `//*[contains(text(), '${keywords.split('|')[0]}')]`;
                    const elements = await this.page.$x(xpath);
                    element = elements[0];
                } else {
                    element = await this.page.$(selector);
                }

                if (element) {
                    const isVisible = await element.isIntersectingViewport();
                    if (isVisible) {
                        await this.humanClick(element);
                        this.addLog(`✅ ${stepName} 성공 (${selector})`, 'success');
                        return true;
                    }
                }
            }

            this.addLog(`⚠️ ${stepName} 요소를 찾을 수 없음`, 'warning');
            return false;
        } catch (error) {
            this.addLog(`❌ ${stepName} 실패: ${error.message}`, 'error');
            return false;
        }
    }

    async handleWaitingQueue() {
        try {
            // 대기열 감지 키워드
            const queueKeywords = ['대기', 'waiting', 'queue', '잠시만', '대기열', '순번'];
            
            const pageText = await this.page.evaluate(() => document.body.textContent);
            const hasQueue = queueKeywords.some(keyword => 
                pageText.toLowerCase().includes(keyword.toLowerCase())
            );

            if (hasQueue) {
                this.addLog('🚦 대기열 감지됨 - 우회 시도 중...', 'warning');
                
                // 방법 1: 새로고침 시도
                await this.bypassQueueWithRefresh();
                
                // 방법 2: 다른 URL로 접근 시도
                await this.bypassQueueWithAlternateUrl();
                
                // 방법 3: 캐시 무시하고 재로드
                await this.bypassQueueWithHardRefresh();
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('대기열 처리 오류:', error);
            return false;
        }
    }

    async bypassQueueWithRefresh() {
        try {
            this.addLog('🔄 빠른 새로고침으로 대기열 우회 시도...', 'info');
            
            // 빠른 연속 새로고침 (3회)
            for(let i = 0; i < 3; i++) {
                await this.page.reload({ waitUntil: 'domcontentloaded' });
                await this.sleep(500 + Math.random() * 500); // 0.5-1초 랜덤 대기
                
                const pageText = await this.page.evaluate(() => document.body.textContent);
                if (!pageText.includes('대기') && !pageText.includes('waiting')) {
                    this.addLog('✅ 새로고침으로 대기열 우회 성공!', 'success');
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    async bypassQueueWithAlternateUrl() {
        try {
            const currentUrl = await this.page.url();
            
            // URL 패턴 수정 시도
            const alternateUrls = [
                currentUrl.replace('www.', ''),           // www 제거
                currentUrl.replace('http://', 'https://'), // https로 변경
                currentUrl + '?direct=1',                  // direct 파라미터 추가
                currentUrl + '&bypass=1',                  // bypass 파라미터 추가
                currentUrl.replace('tickets.', 'ticket.') // 서브도메인 변경
            ];
            
            for(const url of alternateUrls) {
                try {
                    this.addLog(`🔗 대체 URL 시도: ${url}`, 'info');
                    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 });
                    
                    const pageText = await this.page.evaluate(() => document.body.textContent);
                    if (!pageText.includes('대기') && !pageText.includes('waiting')) {
                        this.addLog('✅ 대체 URL로 대기열 우회 성공!', 'success');
                        return true;
                    }
                } catch (e) {
                    // 다음 URL 시도
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    async bypassQueueWithHardRefresh() {
        try {
            this.addLog('💪 강력 새로고침으로 대기열 우회 시도...', 'info');
            
            // 캐시 무시하고 강력 새로고침
            await this.page.reload({ 
                waitUntil: 'networkidle2', 
                timeout: 10000 
            });
            
            await this.sleep(2000);
            
            const pageText = await this.page.evaluate(() => document.body.textContent);
            if (!pageText.includes('대기') && !pageText.includes('waiting')) {
                this.addLog('✅ 강력 새로고침으로 대기열 우회 성공!', 'success');
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    async multiInstanceStrategy() {
        try {
            this.addLog('🚀 다중 인스턴스 전략 시작...', 'success');
            
            const browsers = [];
            const maxInstances = 3;
            
            for(let i = 0; i < maxInstances; i++) {
                const browser = await puppeteer.launch({
                    headless: false,
                    defaultViewport: null,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage'
                    ]
                });
                
                browsers.push(browser);
                
                const page = await browser.newPage();
                const currentUrl = await this.page.url();
                
                // 각 인스턴스마다 약간 다른 접근
                const modifiedUrl = currentUrl + `?instance=${i}&t=${Date.now()}`;
                
                page.goto(modifiedUrl, { waitUntil: 'networkidle2' }).catch(() => {});
                
                this.addLog(`🔄 인스턴스 ${i+1} 시작됨`, 'info');
                await this.sleep(1000); // 1초 간격으로 시작
            }
            
            // 가장 빠르게 로드된 인스턴스 확인
            setTimeout(() => {
                browsers.forEach((browser, index) => {
                    browser.pages().then(pages => {
                        if(pages.length > 1) {
                            const page = pages[1]; // 첫 번째는 about:blank
                            page.evaluate(() => document.body.textContent).then(text => {
                                if(!text.includes('대기') && !text.includes('waiting')) {
                                    this.addLog(`✅ 인스턴스 ${index+1}에서 대기열 우회 성공!`, 'success');
                                    // 성공한 인스턴스를 메인으로 전환
                                    this.page = page;
                                }
                            });
                        }
                    });
                });
            }, 5000);
            
        } catch (error) {
            console.error('다중 인스턴스 전략 오류:', error);
        }
    }

    async preciseTimingAttack(targetTime) {
        // 정확한 시간에 맞춰서 접속하는 기능
        const now = new Date();
        const target = new Date(targetTime);
        const waitTime = target.getTime() - now.getTime();
        
        if(waitTime > 0) {
            this.addLog(`⏰ ${Math.round(waitTime/1000)}초 후 정확한 타이밍 공격 시작`, 'info');
            
            setTimeout(async () => {
                this.addLog('🎯 정확한 타이밍 공격 시작!', 'success');
                
                // 동시에 여러 방법으로 접근
                await Promise.all([
                    this.page.reload({ waitUntil: 'domcontentloaded' }),
                    this.multiInstanceStrategy(),
                    this.bypassQueueWithRefresh()
                ]);
                
            }, waitTime - 100); // 100ms 일찍 시작해서 네트워크 지연 고려
        }
    }

    saveSettings() {
        const settings = {
            ticketCount: document.getElementById('ticketCount').value,
            seatGrade: document.getElementById('seatGrade').value,
            autoRefresh: document.getElementById('autoRefresh').value
        };
        localStorage.setItem('ticketingSettings', JSON.stringify(settings));
    }

    loadSettings() {
        const saved = localStorage.getItem('ticketingSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            document.getElementById('ticketCount').value = settings.ticketCount || '1';
            document.getElementById('seatGrade').value = settings.seatGrade || 'any';
            document.getElementById('autoRefresh').value = settings.autoRefresh || '2000';
        }
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new TicketingApp();
});