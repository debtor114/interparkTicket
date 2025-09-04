// 로그인 상태 감지 클래스
class LoginDetector {
    
    // 인터파크 로그인 확인
    static checkInterparkLogin() {
        console.log('[InterparkLogin] Checking Interpark login status...');
        const userMenu = document.querySelector('._my-menu-root_1xzlz_1');
        console.log('[InterparkLogin] userMenu found:', userMenu);
        
        if (userMenu) {
            const userNameElement = userMenu.querySelector('li');
            console.log('[InterparkLogin] userNameElement in userMenu:', userNameElement?.textContent.trim());
            if (userNameElement && userNameElement.textContent.includes('님')) {
                return {
                    isLoggedIn: true,
                    userName: userNameElement.textContent.trim()
                };
            }
        }

        const userNameElements = document.querySelectorAll('li');
        console.log('[InterparkLogin] Checking other li elements for "님" pattern...');
        for (let element of userNameElements) {
            if (element.textContent && element.textContent.includes('님') && 
                element.textContent.match(/[가-힣a-zA-Z0-9]+님/)) {
                console.log('[InterparkLogin] Found "님" pattern:', element.textContent.trim());
                return {
                    isLoggedIn: true,
                    userName: element.textContent.trim()
                };
            }
        }

        console.log('[InterparkLogin] No login indicators found.');
        return { isLoggedIn: false, userName: null };
    }

    // 티켓링크 로그인 확인
    static checkTicketlinkLogin() {
        const patterns = ['.gnb-user-name', '.user-info', '.member-info', '[class*="login-user"]'];
        
        for (let pattern of patterns) {
            const elements = document.querySelectorAll(pattern);
            for (let element of elements) {
                const text = element.textContent?.trim();
                if (text && (text.includes('님') || text.includes('마이페이지'))) {
                    return {
                        isLoggedIn: true,
                        userName: text
                    };
                }
            }
        }
        
        return { isLoggedIn: false, userName: null };
    }

    // Yes24 로그인 확인
    static checkYes24Login() {
        const userSelectors = ['.myd_name', '.login-info', '.member-name', '.user-info'];
        
        for (let selector of userSelectors) {
            const elements = document.querySelectorAll(selector);
            for (let element of elements) {
                const text = element.textContent?.trim();
                if (text && (text.includes('님') || text.includes('마이페이지'))) {
                    return {
                        isLoggedIn: true,
                        userName: text
                    };
                }
            }
        }
        
        return { isLoggedIn: false, userName: null };
    }

    // 멜론 로그인 확인
    static checkMelonLogin() {
        const userSelectors = ['.memberinfo', '.login_area', '.user_name', '.member_info'];
        
        for (let selector of userSelectors) {
            const elements = document.querySelectorAll(selector);
            for (let element of elements) {
                const text = element.textContent?.trim();
                if (text && (text.includes('님') || text.includes('로그아웃'))) {
                    return {
                        isLoggedIn: true,
                        userName: text
                    };
                }
            }
        }
        
        return { isLoggedIn: false, userName: null };
    }

    // 범용 로그인 확인 (모든 사이트 적용)
    static checkUniversalLogin() {
        const strategies = [
            LoginDetector.checkByCommonUserIndicators,
            LoginDetector.checkByLogoutButton,
            LoginDetector.checkByUserMenu,
            LoginDetector.checkByUrlPattern,
            LoginDetector.checkByTextContent
        ];

        for (let strategy of strategies) {
            const result = strategy();
            if (result.isLoggedIn) {
                return result;
            }
        }

        return { isLoggedIn: false, userName: null };
    }

    // 일반적인 사용자 지표로 확인
    static checkByCommonUserIndicators() {
        const commonSelectors = [
            '.user-name', '.username', '.member-name', '.member-info',
            '.user-info', '.profile-name', '.account-name', '.login-user',
            '[class*="user"]', '[class*="member"]', '[class*="profile"]'
        ];

        for (let selector of commonSelectors) {
            const elements = document.querySelectorAll(selector);
            for (let element of elements) {
                const text = element.textContent?.trim();
                if (text && text.length > 0 && text.length < 50) {
                    if (text.includes('님') || text.match(/[가-힣]+$/)) {
                        return {
                            isLoggedIn: true,
                            userName: text
                        };
                    }
                }
            }
        }
        
        return { isLoggedIn: false, userName: null };
    }

    // 로그아웃 버튼으로 확인
    static checkByLogoutButton() {
        const logoutSelectors = [
            'a[href*="logout"]', 'button[onclick*="logout"]', 
            '.logout', '.signout', '[class*="logout"]'
        ];

        for (let selector of logoutSelectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                return {
                    isLoggedIn: true,
                    userName: 'Logged In User'
                };
            }
        }
        
        return { isLoggedIn: false, userName: null };
    }

    // 사용자 메뉴로 확인
    static checkByUserMenu() {
        const menuSelectors = [
            '.user-menu', '.member-menu', '.profile-menu',
            '.my-menu', '.account-menu', '[class*="user-menu"]'
        ];

        for (let selector of menuSelectors) {
            const menu = document.querySelector(selector);
            if (menu) {
                const text = menu.textContent?.trim();
                if (text && (text.includes('마이페이지') || text.includes('내정보') || 
                           text.includes('My') || text.includes('님'))) {
                    return {
                        isLoggedIn: true,
                        userName: text.split(/\s+/)[0]
                    };
                }
            }
        }
        
        return { isLoggedIn: false, userName: null };
    }

    // URL 패턴으로 확인
    static checkByUrlPattern() {
        const loginUrls = ['/mypage', '/profile', '/member', '/account', '/my'];
        const currentPath = window.location.pathname.toLowerCase();
        
        if (loginUrls.some(path => currentPath.includes(path))) {
            return {
                isLoggedIn: true,
                userName: 'URL-based Detection'
            };
        }
        
        return { isLoggedIn: false, userName: null };
    }

    // 텍스트 내용으로 확인
    static checkByTextContent() {
        const bodyText = document.body.textContent.toLowerCase();
        const loginIndicators = ['환영합니다', 'welcome', '님', '로그아웃', 'logout', 'sign out'];
        const notLoginIndicators = ['로그인', 'login', 'sign in', '회원가입'];

        const loginScore = loginIndicators.filter(indicator => bodyText.includes(indicator)).length;
        const notLoginScore = notLoginIndicators.filter(indicator => bodyText.includes(indicator)).length;

        if (loginScore > notLoginScore && loginScore >= 2) {
            return {
                isLoggedIn: true,
                userName: 'Text-based Detection'
            };
        }
        
        return { isLoggedIn: false, userName: null };
    }
}

// 전역 사용을 위해 window 객체에 등록
window.LoginDetector = LoginDetector;