// 범용 티켓팅 자동화 시스템
// 모든 티켓팅 사이트에 적용 가능한 일반화된 플로우 엔진

class UniversalTicketingSystem {
    constructor() {
        this.currentSite = null;
        this.siteConfig = null;
        this.flowEngine = new TicketingFlowEngine();
        this.dataCollector = new UniversalDataCollector();
        this.automationEngine = new AutomationEngine();
        this.extensionDataManager = new ExtensionDataManager(); // 확장 프로그램 데이터 관리
        
        this.init();
    }

    async init() {
        await this.detectCurrentSite();
        await this.loadSiteConfiguration();
        this.setupFlowEngine();
        console.log(`🎫 범용 티켓팅 시스템 초기화 완료 - 사이트: ${this.currentSite?.name}`);
    }

    // 현재 사이트 자동 감지
    async detectCurrentSite() {
        const hostname = window.location.hostname;
        const url = window.location.href;
        const title = document.title;
        
        // 알려진 티켓팅 사이트들 확인
        const knownSites = this.getKnownSites();
        let detectedSite = knownSites.find(site => 
            site.domains.some(domain => hostname.includes(domain))
        );

        // 알려진 사이트가 아니면 휴리스틱으로 판단
        if (!detectedSite) {
            detectedSite = await this.detectTicketingSiteHeuristic();
        }

        this.currentSite = detectedSite || {
            name: 'unknown',
            type: 'generic',
            domains: [hostname],
            isTicketingSite: await this.isLikelyTicketingSite()
        };
    }

    // 알려진 티켓팅 사이트 목록
    getKnownSites() {
        return [
            {
                name: 'interpark',
                type: 'major',
                domains: ['interpark.com'],
                loginSelectors: ['._my-menu-root_1xzlz_1', '.login-area'],
                ticketSelectors: ['.ticket-link', '.booking-btn'],
                seatSelectors: ['.seat', '[class*="seat"]'],
                paymentSelectors: ['.payment', '.pay-btn']
            },
            {
                name: 'ticketlink', 
                type: 'major',
                domains: ['ticketlink.co.kr'],
                loginSelectors: ['.gnb-user-name', '.user-info'],
                ticketSelectors: ['.ticket-booking', '.reservation'],
                seatSelectors: ['.seat-map', '.seat-btn'],
                paymentSelectors: ['.payment-area', '.order-pay']
            },
            {
                name: 'yes24',
                type: 'major', 
                domains: ['yes24.com'],
                loginSelectors: ['.myd_name', '.login-info'],
                ticketSelectors: ['.booking', '.ticket'],
                seatSelectors: ['.seat', '.seatBtn'],
                paymentSelectors: ['.paymentBtn', '.payment']
            },
            {
                name: 'melon',
                type: 'major',
                domains: ['melon.com'],
                loginSelectors: ['.memberinfo', '.login_area'],
                ticketSelectors: ['.ticket_reserve', '.booking'],
                seatSelectors: ['.seat_area', '.seat'],
                paymentSelectors: ['.payment', '.order']
            }
        ];
    }

    // 휴리스틱으로 티켓팅 사이트 감지
    async detectTicketingSiteHeuristic() {
        const indicators = [
            // 키워드 기반 감지
            { type: 'title', keywords: ['티켓', 'ticket', '예매', 'booking', '콘서트', 'concert'] },
            { type: 'url', keywords: ['ticket', 'booking', 'reserve', '예매'] },
            { type: 'dom', selectors: ['.seat', '.booking', '.ticket', '.payment', '.concert'] },
            { type: 'text', keywords: ['좌석선택', '예매하기', '티켓구매', 'seat selection', 'buy ticket'] }
        ];

        let confidence = 0;
        const detectedFeatures = [];

        for (let indicator of indicators) {
            const score = await this.checkIndicator(indicator);
            confidence += score;
            if (score > 0) {
                detectedFeatures.push({...indicator, score});
            }
        }

        return confidence > 2 ? {
            name: `auto-detected-${Date.now()}`,
            type: 'detected',
            domains: [window.location.hostname],
            confidence: confidence,
            features: detectedFeatures
        } : null;
    }

    // 지표 확인
    async checkIndicator(indicator) {
        switch (indicator.type) {
            case 'title':
                return indicator.keywords.some(keyword => 
                    document.title.toLowerCase().includes(keyword.toLowerCase())) ? 1 : 0;
                    
            case 'url':
                return indicator.keywords.some(keyword => 
                    window.location.href.toLowerCase().includes(keyword.toLowerCase())) ? 1 : 0;
                    
            case 'dom':
                return indicator.selectors.some(selector => 
                    document.querySelector(selector)) ? 2 : 0;
                    
            case 'text':
                const bodyText = document.body.textContent.toLowerCase();
                return indicator.keywords.some(keyword => 
                    bodyText.includes(keyword.toLowerCase())) ? 0.5 : 0;
                    
            default:
                return 0;
        }
    }

    // 티켓팅 사이트일 가능성 확인
    async isLikelyTicketingSite() {
        const ticketingKeywords = [
            '티켓', 'ticket', '예매', 'booking', '좌석', 'seat', 
            '콘서트', 'concert', '공연', 'show', '결제', 'payment'
        ];

        const pageContent = document.body.textContent.toLowerCase();
        const foundKeywords = ticketingKeywords.filter(keyword => 
            pageContent.includes(keyword.toLowerCase())).length;

        return foundKeywords >= 3; // 3개 이상의 키워드가 있으면 티켓팅 사이트로 판단
    }

    // 사이트 설정 로드
    async loadSiteConfiguration() {
        if (!this.currentSite) return;

        // 기본 설정
        this.siteConfig = {
            site: this.currentSite,
            flow: {
                steps: ['login', 'event_selection', 'seat_selection', 'payment', 'confirmation'],
                currentStep: 'unknown'
            },
            selectors: await this.generateUniversalSelectors(),
            timing: {
                defaultDelay: 1000,
                longDelay: 3000,
                shortDelay: 500
            },
            detection: {
                login: await this.generateLoginDetection(),
                ticketing: await this.generateTicketingDetection(),
                payment: await this.generatePaymentDetection()
            }
        };
    }

    // 범용 셀렉터 생성
    async generateUniversalSelectors() {
        return {
            login: [
                // 일반적인 로그인 관련 셀렉터
                'input[type="email"]', 'input[name*="email"]', 'input[name*="id"]', 'input[name*="user"]',
                'input[type="password"]', 'input[name*="pass"]', 'input[name*="pwd"]',
                'button[type="submit"]', '.login-btn', '.signin-btn', '[onclick*="login"]',
                '.login-form', '#loginForm', '.signin-form'
            ],
            ticketing: [
                // 티켓팅 관련 셀렉터  
                '.ticket', '.booking', '.reserve', '.buy-ticket', '.purchase',
                '[href*="ticket"]', '[href*="booking"]', '[href*="reserve"]',
                '.event-list', '.concert-list', '.show-list'
            ],
            seats: [
                // 좌석 관련 셀렉터
                '.seat', '.seat-btn', '.seat-map', '[class*="seat"]',
                '[data-seat]', '[seat-id]', '.chair', '.section'
            ],
            payment: [
                // 결제 관련 셀렉터
                '.payment', '.pay-btn', '.order-btn', '.checkout',
                '[href*="payment"]', '[onclick*="pay"]', '.card-input',
                'input[name*="card"]', '.payment-method'
            ]
        };
    }

    // 로그인 감지 설정
    async generateLoginDetection() {
        return {
            indicators: [
                // 로그인된 상태 지표들
                { type: 'text', patterns: ['님', 'welcome', 'logout', '로그아웃', 'mypage', '마이페이지'] },
                { type: 'selector', patterns: ['.user-name', '.member-info', '.my-info', '.profile'] },
                { type: 'url', patterns: ['/mypage', '/profile', '/member'] }
            ],
            notLoggedIn: [
                // 로그인되지 않은 상태 지표들
                { type: 'text', patterns: ['로그인', 'login', 'signin', '회원가입'] },
                { type: 'selector', patterns: ['.login-btn', '.signin-btn', '#login'] }
            ]
        };
    }

    // 티켓팅 페이지 감지
    async generateTicketingDetection() {
        return {
            eventPage: [
                { type: 'url', patterns: ['/event', '/show', '/concert', '/ticket'] },
                { type: 'selector', patterns: ['.event-detail', '.show-info', '.ticket-info'] }
            ],
            seatPage: [
                { type: 'url', patterns: ['/seat', '/booking'] },
                { type: 'selector', patterns: ['.seat-map', '.seat-area', '.booking-area'] }
            ],
            paymentPage: [
                { type: 'url', patterns: ['/payment', '/order', '/checkout'] },
                { type: 'selector', patterns: ['.payment-area', '.order-form', '.checkout-form'] }
            ]
        };
    }

    // 결제 페이지 감지
    async generatePaymentDetection() {
        return {
            indicators: [
                { type: 'text', patterns: ['결제', 'payment', '카드', 'card', '총액', 'total'] },
                { type: 'selector', patterns: ['.payment-form', '.card-form', '.billing'] },
                { type: 'input', patterns: ['card-number', 'card_number', 'cardNo'] }
            ]
        };
    }

    // 플로우 엔진 설정
    setupFlowEngine() {
        this.flowEngine.configure(this.siteConfig);
        this.flowEngine.onStepChange((step) => {
            console.log(`🎯 플로우 단계 변경: ${step}`);
            this.handleFlowStepChange(step);
        });
    }

    // 플로우 단계 변경 처리
    handleFlowStepChange(step) {
        switch (step) {
            case 'login':
                this.dataCollector.startCollecting('login');
                break;
            case 'event_selection':
                this.dataCollector.startCollecting('events');
                break;
            case 'seat_selection':
                this.dataCollector.startCollecting('seats');
                break;
            case 'payment':
                this.dataCollector.startCollecting('payment');
                break;
        }
    }

    // 현재 사이트 설정 가져오기
    getSiteConfig() {
        return this.siteConfig;
    }

    // 자동화 시작
    async startAutomation(config) {
        return await this.automationEngine.start(config, this.siteConfig);
    }

    // 데이터 분석
    async analyzeCollectedData() {
        return await this.dataCollector.analyze();
    }
}

// 티켓팅 플로우 엔진
class TicketingFlowEngine {
    constructor() {
        this.config = null;
        this.currentStep = 'unknown';
        this.stepHistory = [];
        this.stepChangeCallbacks = [];
    }

    configure(siteConfig) {
        this.config = siteConfig;
        this.startFlowDetection();
    }

    // 플로우 감지 시작
    startFlowDetection() {
        // URL 변화 감지
        let currentUrl = window.location.href;
        setInterval(() => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                this.detectCurrentStep();
            }
        }, 1000);

        // DOM 변화 감지
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(() => {
                this.detectCurrentStep();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // 초기 단계 감지
        this.detectCurrentStep();
    }

    // 현재 단계 감지
    detectCurrentStep() {
        const previousStep = this.currentStep;
        let detectedStep = 'unknown';

        // URL 기반 감지
        const url = window.location.href.toLowerCase();
        if (url.includes('login') || url.includes('signin')) {
            detectedStep = 'login';
        } else if (url.includes('seat') || url.includes('booking')) {
            detectedStep = 'seat_selection';
        } else if (url.includes('payment') || url.includes('order')) {
            detectedStep = 'payment';
        } else if (url.includes('confirm') || url.includes('complete')) {
            detectedStep = 'confirmation';
        }

        // DOM 기반 감지 (URL로 판단되지 않은 경우)
        if (detectedStep === 'unknown') {
            detectedStep = this.detectStepByDOM();
        }

        // 단계가 변경된 경우
        if (detectedStep !== previousStep && detectedStep !== 'unknown') {
            this.currentStep = detectedStep;
            this.stepHistory.push({
                step: detectedStep,
                timestamp: Date.now(),
                url: window.location.href
            });
            
            this.notifyStepChange(detectedStep);
        }
    }

    // DOM 기반 단계 감지
    detectStepByDOM() {
        // 로그인 페이지 감지
        if (document.querySelector('input[type="password"]') && 
            document.querySelector('input[type="email"], input[name*="id"]')) {
            return 'login';
        }

        // 좌석 선택 페이지 감지
        if (document.querySelector('.seat, [class*="seat"]') ||
            document.querySelector('.seat-map, .booking-area')) {
            return 'seat_selection';
        }

        // 결제 페이지 감지
        if (document.querySelector('input[name*="card"]') ||
            document.querySelector('.payment, .checkout')) {
            return 'payment';
        }

        // 이벤트 선택 페이지 감지 (기본값)
        if (document.querySelector('.ticket, .booking, .event')) {
            return 'event_selection';
        }

        return 'unknown';
    }

    // 단계 변경 알림
    notifyStepChange(step) {
        this.stepChangeCallbacks.forEach(callback => {
            try {
                callback(step);
            } catch (error) {
                console.error('플로우 단계 변경 콜백 오류:', error);
            }
        });
    }

    // 단계 변경 콜백 등록
    onStepChange(callback) {
        this.stepChangeCallbacks.push(callback);
    }

    // 현재 단계 반환
    getCurrentStep() {
        return this.currentStep;
    }

    // 단계 히스토리 반환
    getStepHistory() {
        return this.stepHistory;
    }
}

// 범용 데이터 수집기
class UniversalDataCollector {
    constructor() {
        this.collectedData = {
            login: [],
            events: [], 
            seats: [],
            payment: [],
            network: [],
            interactions: []
        };
        this.isCollecting = {};
    }

    startCollecting(dataType) {
        this.isCollecting[dataType] = true;
        console.log(`📊 데이터 수집 시작: ${dataType}`);
        
        switch (dataType) {
            case 'login':
                this.collectLoginData();
                break;
            case 'events':
                this.collectEventData();
                break;
            case 'seats':
                this.collectSeatData();
                break;
            case 'payment':
                this.collectPaymentData();
                break;
        }
    }

    // 로그인 데이터 수집
    collectLoginData() {
        const loginElements = document.querySelectorAll(
            'input[type="email"], input[type="password"], input[name*="id"], input[name*="pass"], .login-btn'
        );
        
        loginElements.forEach(element => {
            this.collectedData.login.push({
                type: 'element',
                tagName: element.tagName,
                type_attr: element.type,
                name: element.name,
                id: element.id,
                className: element.className,
                xpath: this.generateXPath(element),
                timestamp: Date.now()
            });
        });
    }

    // 이벤트 데이터 수집
    collectEventData() {
        const eventElements = document.querySelectorAll(
            '.ticket, .booking, .event, .concert, .show, [href*="ticket"], [href*="book"]'
        );
        
        eventElements.forEach(element => {
            this.collectedData.events.push({
                type: 'element',
                tagName: element.tagName,
                textContent: element.textContent?.slice(0, 100),
                href: element.href,
                id: element.id,
                className: element.className,
                xpath: this.generateXPath(element),
                timestamp: Date.now()
            });
        });
    }

    // 좌석 데이터 수집
    collectSeatData() {
        const seatElements = document.querySelectorAll(
            '.seat, [class*="seat"], [data-seat], .chair'
        );
        
        seatElements.forEach(element => {
            this.collectedData.seats.push({
                type: 'element',
                tagName: element.tagName,
                seatInfo: element.dataset.seat || element.textContent?.slice(0, 20),
                id: element.id,
                className: element.className,
                xpath: this.generateXPath(element),
                position: element.getBoundingClientRect(),
                timestamp: Date.now()
            });
        });
    }

    // 결제 데이터 수집
    collectPaymentData() {
        const paymentElements = document.querySelectorAll(
            'input[name*="card"], .payment, .checkout, .order-btn'
        );
        
        paymentElements.forEach(element => {
            this.collectedData.payment.push({
                type: 'element',
                tagName: element.tagName,
                inputType: element.type,
                name: element.name,
                id: element.id,
                className: element.className,
                xpath: this.generateXPath(element),
                timestamp: Date.now()
            });
        });
    }

    // XPath 생성
    generateXPath(element) {
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        
        let path = '';
        for (let current = element; current && current.nodeType === Node.ELEMENT_NODE; current = current.parentNode) {
            let selector = current.nodeName.toLowerCase();
            if (current.id) {
                selector += `[@id="${current.id}"]`;
                path = '/' + selector + path;
                break;
            } else {
                let nth = 1;
                for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
                    if (sibling.nodeName.toLowerCase() === selector) {
                        nth++;
                    }
                }
                selector += `[${nth}]`;
            }
            path = '/' + selector + path;
        }
        return path;
    }

    // 수집된 데이터 분석
    async analyze() {
        const analysis = {
            summary: {
                loginElements: this.collectedData.login.length,
                eventElements: this.collectedData.events.length,
                seatElements: this.collectedData.seats.length,
                paymentElements: this.collectedData.payment.length
            },
            automationConfig: this.generateAutomationConfig(),
            recommendations: this.generateRecommendations()
        };

        console.log('📈 데이터 분석 완료:', analysis);
        return analysis;
    }

    // 자동화 설정 생성
    generateAutomationConfig() {
        return {
            login: {
                emailSelector: this.findBestSelector('login', 'email'),
                passwordSelector: this.findBestSelector('login', 'password'),
                submitSelector: this.findBestSelector('login', 'submit')
            },
            ticketing: {
                eventSelectors: this.findBestSelectors('events', 3),
                seatSelectors: this.findBestSelectors('seats', 5)
            },
            payment: {
                paymentSelectors: this.findBestSelectors('payment', 3)
            }
        };
    }

    // 최적 셀렉터 찾기
    findBestSelector(dataType, elementType) {
        const data = this.collectedData[dataType];
        if (!data.length) return null;

        // 타입별 우선순위 필터링
        let filtered = data.filter(item => {
            switch (elementType) {
                case 'email':
                    return item.type_attr === 'email' || item.name?.includes('email') || item.name?.includes('id');
                case 'password':
                    return item.type_attr === 'password' || item.name?.includes('pass');
                case 'submit':
                    return item.className?.includes('btn') || item.tagName === 'BUTTON';
                default:
                    return true;
            }
        });

        if (filtered.length === 0) filtered = data;

        // ID가 있는 것을 우선
        const withId = filtered.filter(item => item.id);
        if (withId.length > 0) {
            return `#${withId[0].id}`;
        }

        // XPath 반환
        return filtered[0]?.xpath;
    }

    // 여러 셀렉터 찾기
    findBestSelectors(dataType, limit = 3) {
        const data = this.collectedData[dataType];
        return data.slice(0, limit).map(item => ({
            selector: item.id ? `#${item.id}` : item.xpath,
            text: item.textContent,
            className: item.className
        }));
    }

    // 권장사항 생성
    generateRecommendations() {
        return {
            timing: {
                pageLoadWait: 2000,
                actionDelay: 1000,
                formSubmitDelay: 1500
            },
            strategy: this.recommendStrategy(),
            warnings: this.generateWarnings()
        };
    }

    // 전략 추천
    recommendStrategy() {
        const hasSeats = this.collectedData.seats.length > 0;
        const hasPayment = this.collectedData.payment.length > 0;
        
        if (hasSeats && hasPayment) {
            return 'full_automation'; // 완전 자동화 가능
        } else if (hasSeats) {
            return 'semi_automation'; // 좌석까지만 자동화
        } else {
            return 'basic_automation'; // 로그인/검색만 자동화
        }
    }

    // 경고사항 생성
    generateWarnings() {
        const warnings = [];
        
        if (this.collectedData.login.length === 0) {
            warnings.push('로그인 요소를 찾을 수 없습니다.');
        }
        
        if (this.collectedData.seats.length === 0) {
            warnings.push('좌석 선택 요소를 찾을 수 없습니다.');
        }

        return warnings;
    }

    // 수집된 데이터 반환
    getData() {
        return this.collectedData;
    }
}

// 자동화 엔진
class AutomationEngine {
    constructor() {
        this.isRunning = false;
        this.currentConfig = null;
        this.siteConfig = null;
    }

    async start(automationConfig, siteConfig) {
        if (this.isRunning) {
            throw new Error('자동화가 이미 실행 중입니다.');
        }

        this.isRunning = true;
        this.currentConfig = automationConfig;
        this.siteConfig = siteConfig;

        console.log('🤖 자동화 엔진 시작');
        
        try {
            await this.executeAutomationFlow();
        } catch (error) {
            console.error('자동화 실행 오류:', error);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    async executeAutomationFlow() {
        const steps = this.siteConfig.flow.steps;
        
        for (let step of steps) {
            console.log(`🎯 자동화 단계 실행: ${step}`);
            
            switch (step) {
                case 'login':
                    await this.executeLogin();
                    break;
                case 'event_selection':
                    await this.executeEventSelection();
                    break;
                case 'seat_selection':
                    await this.executeSeatSelection();
                    break;
                case 'payment':
                    await this.executePayment();
                    break;
            }
            
            // 단계간 대기
            await this.wait(this.siteConfig.timing.defaultDelay);
        }
    }

    async executeLogin() {
        const loginConfig = this.currentConfig.login;
        if (!loginConfig.credentials) return;

        // 이메일/ID 입력
        if (loginConfig.emailSelector) {
            await this.fillInput(loginConfig.emailSelector, loginConfig.credentials.email);
        }

        // 비밀번호 입력
        if (loginConfig.passwordSelector) {
            await this.fillInput(loginConfig.passwordSelector, loginConfig.credentials.password);
        }

        // 로그인 버튼 클릭
        if (loginConfig.submitSelector) {
            await this.clickElement(loginConfig.submitSelector);
        }

        // 로그인 완료 대기
        await this.wait(this.siteConfig.timing.longDelay);
    }

    async executeEventSelection() {
        // 이벤트 선택 로직 구현
        console.log('이벤트 선택 실행');
    }

    async executeSeatSelection() {
        // 좌석 선택 로직 구현
        console.log('좌석 선택 실행');
    }

    async executePayment() {
        // 결제 로직 구현
        console.log('결제 실행');
    }

    // 입력 필드 채우기
    async fillInput(selector, value) {
        const element = document.querySelector(selector);
        if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // 요소 클릭
    async clickElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.click();
        }
    }

    // 대기
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 중지
    stop() {
        this.isRunning = false;
        console.log('🛑 자동화 엔진 중지');
    }
}

// 크롬 확장 프로그램 데이터 관리 클래스
class ExtensionDataManager {
    constructor() {
        this.extensionId = null;
        this.isExtensionAvailable = false;
        this.selectorDatabase = new Map();
        this.lastSyncTime = null;
        
        this.init();
    }

    async init() {
        console.log('🔌 확장 프로그램 데이터 매니저 초기화 시작');
        
        // 확장 프로그램 연결 시도
        await this.detectExtension();
        
        if (this.isExtensionAvailable) {
            await this.syncExtensionData();
            this.startPeriodicSync();
        } else {
            console.log('❌ 확장 프로그램을 찾을 수 없습니다. 기본 모드로 실행합니다.');
        }
    }

    // 확장 프로그램 감지
    async detectExtension() {
        try {
            // Chrome 확장 프로그램과 통신 시도
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                // 확장 프로그램 ID들을 시도해봄
                const possibleIds = [
                    'your-extension-id-here', // 실제 확장 프로그램 ID로 변경 필요
                    'ticketing-monitor-extension'
                ];

                for (const id of possibleIds) {
                    try {
                        await new Promise((resolve, reject) => {
                            chrome.runtime.sendMessage(id, { type: 'PING' }, (response) => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else {
                                    resolve(response);
                                }
                            });
                        });
                        
                        this.extensionId = id;
                        this.isExtensionAvailable = true;
                        console.log(`✅ 확장 프로그램 연결 성공: ${id}`);
                        break;
                    } catch (error) {
                        continue;
                    }
                }
            }

            // Chrome Storage API를 통한 데이터 접근 시도 (확장 프로그램이 설치된 경우)
            if (!this.isExtensionAvailable && typeof chrome !== 'undefined' && chrome.storage) {
                try {
                    const testData = await chrome.storage.local.get(['test_key']);
                    this.isExtensionAvailable = true;
                    console.log('✅ Chrome Storage API를 통한 확장 프로그램 데이터 접근 가능');
                } catch (error) {
                    console.log('Chrome Storage API 접근 불가');
                }
            }

        } catch (error) {
            console.log('확장 프로그램 감지 중 오류:', error);
            this.isExtensionAvailable = false;
        }
    }

    // 확장 프로그램 데이터 동기화
    async syncExtensionData() {
        if (!this.isExtensionAvailable) return;

        try {
            console.log('🔄 확장 프로그램 데이터 동기화 시작');
            
            // 현재 사이트의 DOM 분석 데이터 가져오기
            const siteKey = this.getCurrentSiteKey();
            const dataKeys = [
                `latest_analysis_${siteKey}`,
                `selector_patterns_${siteKey}`,
                `electron_data_${siteKey}`
            ];

            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(dataKeys);
                
                // 데이터 처리
                const analysisData = result[`latest_analysis_${siteKey}`];
                const selectorPatterns = result[`selector_patterns_${siteKey}`];
                const electronData = result[`electron_data_${siteKey}`];

                if (analysisData) {
                    console.log('📊 DOM 분석 데이터 수신:', analysisData);
                    await this.processAnalysisData(analysisData);
                }

                if (selectorPatterns) {
                    console.log('🎯 셀렉터 패턴 데이터 수신:', selectorPatterns);
                    this.updateSelectorDatabase(selectorPatterns);
                }

                if (electronData) {
                    console.log('⚡ Electron 전용 데이터 수신:', electronData);
                    await this.applyElectronData(electronData);
                }

                this.lastSyncTime = new Date();
                console.log('✅ 확장 프로그램 데이터 동기화 완료');
            }

        } catch (error) {
            console.error('확장 프로그램 데이터 동기화 실패:', error);
        }
    }

    // DOM 분석 데이터 처리
    async processAnalysisData(analysisData) {
        const elements = analysisData.elements;
        
        // 각 요소 타입별로 셀렉터 저장
        Object.keys(elements).forEach(elementType => {
            const elementList = elements[elementType] || [];
            
            elementList.forEach(element => {
                const selector = {
                    xpath: element.xpath,
                    cssSelector: this.generateCSSSelector(element),
                    text: element.text,
                    confidence: this.calculateConfidence(element, elementType),
                    lastUpdated: new Date().toISOString()
                };

                // 셀렉터 데이터베이스에 저장
                const key = `${elementType}_${this.getCurrentSiteKey()}`;
                if (!this.selectorDatabase.has(key)) {
                    this.selectorDatabase.set(key, []);
                }
                this.selectorDatabase.get(key).push(selector);
            });
        });

        console.log('셀렉터 데이터베이스 업데이트 완료:', this.selectorDatabase.size, '개 항목');
    }

    // CSS 셀렉터 생성
    generateCSSSelector(element) {
        let selector = element.tag.toLowerCase();
        
        if (element.id) {
            selector += `#${element.id}`;
        } else if (element.className) {
            const classes = element.className.split(' ')
                .filter(cls => cls.trim())
                .slice(0, 2);
            if (classes.length > 0) {
                selector += '.' + classes.join('.');
            }
        }

        return selector;
    }

    // 신뢰도 계산
    calculateConfidence(element, elementType) {
        let confidence = 0.5;
        
        if (element.visible) confidence += 0.2;
        if (element.onclick) confidence += 0.2;
        
        // 텍스트 매칭
        const relevantKeywords = this.getRelevantKeywords(elementType);
        const text = (element.text || '').toLowerCase();
        const matches = relevantKeywords.filter(keyword => text.includes(keyword)).length;
        confidence += Math.min(matches * 0.1, 0.3);

        return Math.min(confidence, 1.0);
    }

    // 관련 키워드
    getRelevantKeywords(elementType) {
        const keywords = {
            reservationButtons: ['예매', '예약', '구매', 'book', 'reserve', 'buy'],
            seatSelectors: ['좌석', 'seat', 'chair'],
            priceElements: ['원', 'price', 'cost'],
            dateSelectors: ['날짜', 'date'],
            quantitySelectors: ['수량', 'qty', 'quantity'],
            paymentButtons: ['결제', 'payment', 'pay'],
            loginElements: ['로그인', 'login', 'password']
        };
        return keywords[elementType] || [];
    }

    // 셀렉터 데이터베이스 업데이트
    updateSelectorDatabase(selectorPatterns) {
        Object.keys(selectorPatterns).forEach(elementType => {
            const patterns = selectorPatterns[elementType] || [];
            const key = `${elementType}_${this.getCurrentSiteKey()}`;
            this.selectorDatabase.set(key, patterns);
        });
    }

    // Electron 전용 데이터 적용
    async applyElectronData(electronData) {
        if (electronData.automationScript && electronData.automationScript.actions) {
            console.log('🤖 자동화 스크립트 적용:', electronData.automationScript.actions.length, '개 액션');
            
            // 자동화 스크립트를 현재 시스템에 통합
            window.universalTicketingSystem.flowEngine.updateFromExtensionData(electronData);
        }

        if (electronData.selectorMap) {
            console.log('🎯 셀렉터 맵 적용:', Object.keys(electronData.selectorMap).length, '개 요소');
            
            // 셀렉터 맵을 현재 시스템에 적용
            Object.keys(electronData.selectorMap).forEach(elementType => {
                const selectorInfo = electronData.selectorMap[elementType];
                this.registerBestSelector(elementType, selectorInfo);
            });
        }
    }

    // 최적 셀렉터 등록
    registerBestSelector(elementType, selectorInfo) {
        const key = `best_${elementType}_${this.getCurrentSiteKey()}`;
        this.selectorDatabase.set(key, selectorInfo);
    }

    // 현재 사이트 키 생성
    getCurrentSiteKey() {
        const hostname = window.location.hostname;
        return hostname.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }

    // 주기적 동기화 시작
    startPeriodicSync() {
        // 30초마다 데이터 동기화
        setInterval(() => {
            this.syncExtensionData();
        }, 30000);

        console.log('⏰ 주기적 데이터 동기화 시작 (30초 간격)');
    }

    // 특정 요소 타입의 최적 셀렉터 가져오기
    getBestSelector(elementType) {
        const key = `best_${elementType}_${this.getCurrentSiteKey()}`;
        return this.selectorDatabase.get(key) || null;
    }

    // 모든 셀렉터 가져오기
    getAllSelectors(elementType) {
        const key = `${elementType}_${this.getCurrentSiteKey()}`;
        return this.selectorDatabase.get(key) || [];
    }

    // 연결 상태 확인
    isConnected() {
        return this.isExtensionAvailable;
    }

    // 마지막 동기화 시간
    getLastSyncTime() {
        return this.lastSyncTime;
    }
}

// 전역 인스턴스 생성
window.universalTicketingSystem = new UniversalTicketingSystem();