require('dotenv').config();
const axios = require('axios');

/**
 * 呼叫 Claude API，將程式碼轉換為 pseudocode
 * @param {string} code - 原始程式碼
 * @returns {Promise<string>} - pseudocode
 */
async function codeToPseudocode(code) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error('找不到 CLAUDE_API_KEY，請檢查 .env 檔案');

    // 使用新版 Messages API
    const endpoint = 'https://api.anthropic.com/v1/messages';
    const userMessage = `請將下列程式碼轉換成詳細的 pseudocode，不需要額外解釋，只需要輸出 pseudocode 即可：\n\n${code}`;

    try {
        const response = await axios.post(
            endpoint,
            {
                model: 'claude-3-7-sonnet-20250219',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: userMessage
                    }
                ]
            },
            {
                headers: {
                    'x-api-key': apiKey,
                    'content-type': 'application/json',
                    'anthropic-version': '2023-06-01'
                }
            }
        );

        return response.data.content[0].text;
    } catch (err) {
        if (err.response) {
            // API 回傳的錯誤
            console.error('API 錯誤詳情:', err.response.data);
            throw new Error(`Claude API 請求失敗 (${err.response.status}): ${err.response.data.error?.message || err.message}`);
        } else {
            // 網路或其他錯誤
            throw new Error('Claude API 請求失敗: ' + err.message);
        }
    }
}

module.exports = { codeToPseudocode }; 