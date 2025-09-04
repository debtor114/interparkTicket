// 티켓팅 관련 DOM 요소 검색 클래스
class ElementFinder {
    
    // 예약/예매 버튼 찾기 (인터파크 특화)
    static findReservationButtons() {
        const buttons = [];
        const selectors = [
            // 인터파크 특화 셀렉터들
            'a[href*="/ticket"]',
            'a[href*="/goods/"]',
            'a[href*="book"]',
            'button[class*="btn"]',
            'a[class*="btn"]',
            '.btn',
            '[role="button"]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const text = DOMUtils.safeGetText(element);
                    const value = DOMUtils.safeGetValue(element);
                    const className = DOMUtils.safeGetClassName(element);
                    
                    const reservationKeywords = [
                        '예매', '예약', '구매', 'book', 'reserve', 'buy', 'purchase', 
                        '티켓구매', '바로예매', '선택완료', 'ticket'
                    ];

                    if (reservationKeywords.some(keyword => 
                        text.includes(keyword) || value.includes(keyword) || className.includes(keyword)
                    )) {
                        buttons.push(DOMUtils.getElementInfo(element, 'reservation-button'));
                    }
                });
            } catch (e) {
                console.warn('예약 버튼 검색 중 오류:', e);
            }
        });

        return buttons;
    }

    // 좌석 선택 요소 찾기
    static findSeatSelectors() {
        const seats = [];
        const selectors = [
            '.seat, [class*="seat"]',
            '.chair, [class*="chair"]',
            'svg rect, svg circle, svg path',
            '.grid-item, [class*="grid"]',
            'td[class*="seat"], td[onclick*="seat"]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const isClickable = element.onclick || 
                                      element.addEventListener || 
                                      getComputedStyle(element).cursor === 'pointer';
                    
                    if (isClickable) {
                        seats.push(DOMUtils.getElementInfo(element, 'seat-selector'));
                    }
                });
            } catch (e) {
                console.warn('좌석 선택 요소 검색 중 오류:', e);
            }
        });

        return seats;
    }

    // 가격 정보 요소 찾기
    static findPriceElements() {
        const prices = [];
        const selectors = [
            '[class*="price"], [class*="cost"], [class*="fee"]',
            '[id*="price"], [id*="cost"], [id*="fee"]',
            'span, div, td'
        ];

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const text = element.textContent?.trim() || '';
                    if (/\d{1,3}(,\d{3})*원|\d+,\d+|\$\d+/.test(text)) {
                        prices.push(DOMUtils.getElementInfo(element, 'price-element'));
                    }
                });
            } catch (e) {
                console.warn('가격 요소 검색 중 오류:', e);
            }
        });

        return prices;
    }

    // 날짜 선택 요소 찾기
    static findDateSelectors() {
        const dates = [];
        const selectors = [
            'input[type="date"], select[name*="date"], select[id*="date"]',
            '[class*="date"], [class*="calendar"]',
            'td[onclick*="date"], td[class*="date"]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    dates.push(DOMUtils.getElementInfo(element, 'date-selector'));
                });
            } catch (e) {
                console.warn('날짜 선택 요소 검색 중 오류:', e);
            }
        });

        return dates;
    }

    // 수량 선택 요소 찾기
    static findQuantitySelectors() {
        const quantities = [];
        const selectors = [
            'select[name*="qty"], select[name*="quantity"], select[name*="count"]',
            'input[name*="qty"], input[name*="quantity"], input[name*="count"]',
            '[class*="qty"], [class*="quantity"], [class*="count"]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    quantities.push(DOMUtils.getElementInfo(element, 'quantity-selector'));
                });
            } catch (e) {
                console.warn('수량 선택 요소 검색 중 오류:', e);
            }
        });

        return quantities;
    }

    // 결제 버튼 찾기
    static findPaymentButtons() {
        const buttons = [];
        const selectors = [
            'button, a, input[type="button"], input[type="submit"]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const text = DOMUtils.safeGetText(element);
                    const value = DOMUtils.safeGetValue(element);
                    
                    const paymentKeywords = [
                        '결제', '결제하기', '결제완료', 'payment', 'pay', 'checkout',
                        '주문', '주문하기', '구매완료', 'order'
                    ];

                    if (paymentKeywords.some(keyword => 
                        text.includes(keyword) || value.includes(keyword)
                    )) {
                        buttons.push(DOMUtils.getElementInfo(element, 'payment-button'));
                    }
                });
            } catch (e) {
                console.warn('결제 버튼 검색 중 오류:', e);
            }
        });

        return buttons;
    }

    // 로그인 관련 요소 찾기
    static findLoginElements() {
        const loginElements = [];
        const selectors = [
            'input[type="text"], input[type="email"], input[type="password"]',
            'button[class*="login"], a[class*="login"]',
            'input[type="submit"], input[type="button"]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const placeholder = element.placeholder?.toLowerCase() || '';
                    const name = element.name?.toLowerCase() || '';
                    const id = element.id?.toLowerCase() || '';
                    const text = element.textContent?.toLowerCase() || '';

                    const loginKeywords = [
                        'login', '로그인', 'id', 'email', 'password', '비밀번호',
                        'username', '사용자', 'user'
                    ];

                    if (loginKeywords.some(keyword => 
                        placeholder.includes(keyword) || name.includes(keyword) || 
                        id.includes(keyword) || text.includes(keyword)
                    )) {
                        loginElements.push(DOMUtils.getElementInfo(element, 'login-element'));
                    }
                });
            } catch (e) {
                console.warn('로그인 요소 검색 중 오류:', e);
            }
        });

        return loginElements;
    }

    // 폼 요소들 찾기
    static findFormElements() {
        const forms = [];
        try {
            const formElements = document.querySelectorAll('form');
            formElements.forEach(form => {
                const formData = {
                    tag: form.tagName,
                    action: form.action,
                    method: form.method,
                    id: form.id,
                    className: form.className,
                    xpath: DOMUtils.getXPath(form),
                    fields: []
                };

                const inputs = form.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    formData.fields.push({
                        type: input.type,
                        name: input.name,
                        id: input.id,
                        required: input.required,
                        placeholder: input.placeholder
                    });
                });

                forms.push(formData);
            });
        } catch (e) {
            console.warn('폼 요소 검색 중 오류:', e);
        }

        return forms;
    }

    // 클릭 가능한 요소들 찾기
    static findInteractiveElements() {
        const interactive = [];
        const selectors = [
            'button', 'a', 'input[type="button"]', 'input[type="submit"]',
            '[onclick]', '[role="button"]', '[tabindex]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    interactive.push(DOMUtils.getElementInfo(element, 'interactive-element'));
                });
            } catch (e) {
                console.warn('인터랙티브 요소 검색 중 오류:', e);
            }
        });

        return interactive;
    }
}

// 전역 사용을 위해 window 객체에 등록
window.ElementFinder = ElementFinder;