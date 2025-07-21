import axios from 'axios';

/**
 * 呼叫 Claude API，將程式碼轉換為 pseudocode
 * @param code - 原始程式碼
 * @returns pseudocode
 */
export async function codeToPseudocode(code: string): Promise<string> {
    const apiKey = process.env.CLAUDE_API_KEY;
    console.log('在 claudeApi.ts 中檢查 API Key:', !!apiKey);
    console.log('所有環境變數:', Object.keys(process.env).filter(key => key.includes('CLAUDE')));

    if (!apiKey) {
        throw new Error('找不到 CLAUDE_API_KEY，請檢查 .env 檔案。當前環境變數中沒有此 Key。');
    }

    // 使用新版 Messages API
    const endpoint = 'https://api.anthropic.com/v1/messages';
    const userMessage = `Please convert the following code into detailed pseudocode. No additional explanations are needed; output only the pseudocode: \n\n${code}`;

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
    } catch (err: any) {
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