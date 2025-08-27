const puppeteer = require('puppeteer');

class TicketingAutomation {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isRunning = false;
    }

    async initialize() {
        try {
            this.browser = await puppeteer.launch({
                headless: false, // 브라우저 화면 표시
                defaultViewport: null,
                args: [
                    '--start-maximized',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            });
            
            this.page = await this.browser.newPage();
            return true;
        } catch (error) {
            console.error('브라우저 초기화 실패:', error);
            return false;
        }
    }

    async navigateToSite(url) {
        if (!this.page) {
            throw new Error('브라우저가 초기화되지 않았습니다.');
        }

        try {
            await this.page.goto(url, { waitUntil: 'networkidle2' });
            await this.page.waitForTimeout(2000);
            return true;
        } catch (error) {
            console.error('사이트 이동 실패:', error);
            return false;
        }
    }

    async waitForLogin() {
        // 사용자가 수동으로 로그인할 때까지 대기
        return new Promise((resolve) => {
            const checkLogin = setInterval(async () => {
                try {
                    // 로그인 상태 확인 (사이트마다 다르게 구현)
                    const isLoggedIn = await this.checkLoginStatus();
                    if (isLoggedIn) {
                        clearInterval(checkLogin);
                        resolve(true);
                    }
                } catch (error) {
                    // 로그인 확인 중 에러는 무시
                }
            }, 3000);
        });
    }

    async checkLoginStatus() {
        // 인터파크 티켓 기준 로그인 확인
        try {
            const loginElements = await this.page.$$eval('a', links => 
                links.some(link => link.textContent.includes('로그인'))
            );
            return !loginElements; // 로그인 링크가 없으면 로그인됨
        } catch {
            return false;
        }
    }

    async startAutomation(config) {
        this.isRunning = true;
        const { ticketCount, seatGrade, autoRefresh } = config;

        try {
            while (this.isRunning) {
                await this.refreshPage();
                
                // 예매하기 버튼 찾기
                const bookingButton = await this.findBookingButton();
                if (bookingButton) {
                    await bookingButton.click();
                    console.log('예매 버튼 클릭됨');
                    
                    // 좌석 선택 단계
                    const seatSelected = await this.selectSeat(seatGrade, ticketCount);
                    if (seatSelected) {
                        console.log('좌석 선택 완료');
                        
                        // 결제 진행
                        const paymentStarted = await this.proceedToPayment();
                        if (paymentStarted) {
                            console.log('결제 페이지로 이동 완료');
                            this.isRunning = false;
                            return { success: true, message: '티케팅 성공! 결제를 진행하세요.' };
                        }
                    }
                }

                if (this.isRunning) {
                    await this.page.waitForTimeout(parseInt(autoRefresh));
                }
            }
        } catch (error) {
            console.error('티케팅 자동화 오류:', error);
            return { success: false, error: error.message };
        }
    }

    async refreshPage() {
        try {
            await this.page.reload({ waitUntil: 'networkidle2' });
            await this.page.waitForTimeout(1000);
        } catch (error) {
            console.error('페이지 새로고침 실패:', error);
        }
    }

    async findBookingButton() {
        try {
            // 다양한 예매 버튼 텍스트 패턴
            const buttonSelectors = [
                'button:contains("예매하기")',
                'a:contains("예매하기")',
                'button:contains("BOOKING")',
                'a:contains("BOOKING")',
                '[class*="booking"]',
                '[id*="booking"]'
            ];

            for (const selector of buttonSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        const isVisible = await button.isIntersectingViewport();
                        const isEnabled = await this.page.evaluate(el => 
                            !el.disabled && !el.classList.contains('disabled'), button);
                        
                        if (isVisible && isEnabled) {
                            return button;
                        }
                    }
                } catch {
                    // 선택자가 작동하지 않으면 다음으로
                }
            }

            // XPath로 텍스트 기반 검색
            const xpathSelectors = [
                "//button[contains(text(), '예매')]",
                "//a[contains(text(), '예매')]",
                "//button[contains(text(), 'BOOK')]",
                "//a[contains(text(), 'BOOK')]"
            ];

            for (const xpath of xpathSelectors) {
                try {
                    const [button] = await this.page.$x(xpath);
                    if (button) {
                        const isVisible = await button.isIntersectingViewport();
                        if (isVisible) {
                            return button;
                        }
                    }
                } catch {
                    // XPath가 작동하지 않으면 다음으로
                }
            }

            return null;
        } catch (error) {
            console.error('예매 버튼 찾기 실패:', error);
            return null;
        }
    }

    async selectSeat(seatGrade, ticketCount) {
        try {
            await this.page.waitForTimeout(3000); // 페이지 로딩 대기

            // 좌석 등급 선택
            if (seatGrade !== 'any') {
                const gradeButtons = await this.page.$$(`[class*="${seatGrade}"], [data-grade="${seatGrade}"]`);
                if (gradeButtons.length > 0) {
                    await gradeButtons[0].click();
                    await this.page.waitForTimeout(1000);
                }
            }

            // 매수 선택
            try {
                const countSelect = await this.page.$('select[name*="count"], select[id*="count"]');
                if (countSelect) {
                    await this.page.select('select[name*="count"], select[id*="count"]', ticketCount);
                }
            } catch {
                // 매수 선택 실패는 무시하고 계속
            }

            // 좌석 선택 (자동으로 가능한 좌석 선택)
            const seats = await this.page.$$('.seat-available, [class*="available"], [data-available="true"]');
            const neededSeats = parseInt(ticketCount);
            
            for (let i = 0; i < Math.min(seats.length, neededSeats); i++) {
                await seats[i].click();
                await this.page.waitForTimeout(500);
            }

            // 선택 완료 버튼 찾기
            const completeButtons = await this.page.$x("//button[contains(text(), '선택완료') or contains(text(), '다음') or contains(text(), '확인')]");
            if (completeButtons.length > 0) {
                await completeButtons[0].click();
                await this.page.waitForTimeout(2000);
                return true;
            }

            return false;
        } catch (error) {
            console.error('좌석 선택 실패:', error);
            return false;
        }
    }

    async proceedToPayment() {
        try {
            // 결제하기, 다음단계 등의 버튼 찾기
            const paymentButtons = await this.page.$x(
                "//button[contains(text(), '결제') or contains(text(), '다음') or contains(text(), '계속')]"
            );
            
            if (paymentButtons.length > 0) {
                await paymentButtons[0].click();
                await this.page.waitForTimeout(3000);
                return true;
            }

            return false;
        } catch (error) {
            console.error('결제 진행 실패:', error);
            return false;
        }
    }

    stop() {
        this.isRunning = false;
    }

    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }
        } catch (error) {
            console.error('브라우저 종료 실패:', error);
        }
    }
}

module.exports = TicketingAutomation;