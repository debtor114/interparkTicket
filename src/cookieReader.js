const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('sqlite3').Database;

class CookieReader {
    constructor() {
        this.chromeCookiePath = this.getChromeCookiePath();
    }

    getChromeCookiePath() {
        const userDataPath = os.homedir();
        const platform = os.platform();
        
        if (platform === 'win32') {
            return path.join(userDataPath, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cookies');
        } else if (platform === 'darwin') {
            return path.join(userDataPath, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Cookies');
        } else {
            return path.join(userDataPath, '.config', 'google-chrome', 'Default', 'Cookies');
        }
    }

    async getInterparkCookies() {
        try {
            if (!fs.existsSync(this.chromeCookiePath)) {
                console.log('Chrome 쿠키 파일을 찾을 수 없습니다:', this.chromeCookiePath);
                return null;
            }

            // Chrome 쿠키 파일을 임시로 복사 (Chrome이 사용 중일 때 접근 불가)
            const tempCookiePath = path.join(os.tmpdir(), 'chrome_cookies_temp.db');
            fs.copyFileSync(this.chromeCookiePath, tempCookiePath);

            return new Promise((resolve, reject) => {
                const db = new Database(tempCookiePath, (err) => {
                    if (err) {
                        console.error('쿠키 DB 열기 실패:', err);
                        resolve(null);
                        return;
                    }

                    // 인터파크 관련 쿠키 조회
                    db.all(
                        "SELECT name, value FROM cookies WHERE host_key LIKE '%interpark%' OR host_key LIKE '%nol.interpark%'",
                        (err, rows) => {
                            db.close();
                            
                            try {
                                fs.unlinkSync(tempCookiePath);
                            } catch (e) {
                                // 임시 파일 삭제 실패는 무시
                            }

                            if (err) {
                                console.error('쿠키 조회 실패:', err);
                                resolve(null);
                                return;
                            }

                            resolve(rows);
                        }
                    );
                });
            });
        } catch (error) {
            console.error('쿠키 읽기 오류:', error);
            return null;
        }
    }

    async checkInterparkLogin() {
        try {
            const cookies = await this.getInterparkCookies();
            
            if (!cookies || cookies.length === 0) {
                return { isLoggedIn: false, userName: null };
            }

            // 인터파크 로그인 관련 쿠키 확인
            const loginCookies = cookies.filter(cookie => 
                cookie.name.toLowerCase().includes('login') ||
                cookie.name.toLowerCase().includes('member') ||
                cookie.name.toLowerCase().includes('user') ||
                cookie.name.includes('TKC') ||
                cookie.name.includes('NOL')
            );

            if (loginCookies.length > 0) {
                // 사용자명을 포함한 쿠키가 있는지 확인
                const userNameCookie = cookies.find(cookie => 
                    cookie.value && 
                    (cookie.value.includes('님') || /[가-힣]+/.test(cookie.value))
                );

                let userName = null;
                if (userNameCookie) {
                    const match = userNameCookie.value.match(/([가-힣a-zA-Z0-9]+님?)/);
                    if (match) {
                        userName = match[1].endsWith('님') ? match[1] : match[1] + '님';
                    }
                }

                return { isLoggedIn: true, userName: userName };
            }

            return { isLoggedIn: false, userName: null };
        } catch (error) {
            console.error('인터파크 로그인 확인 오류:', error);
            return { isLoggedIn: false, userName: null };
        }
    }
}

module.exports = CookieReader;