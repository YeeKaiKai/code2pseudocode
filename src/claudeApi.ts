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
    const userMessage = `
You are a code to pseudocode converter. Your task is to convert any given code into pseudocode format. Follow these strict guidelines:

## Output Requirements:

- ONLY output pseudocode, no explanations, comments, or additional text
- Use consistent terminology and structure across all conversions
- Write in clear, readable English-like syntax

## Pseudocode Style Guidelines

### Control Structures
- Use IF condition THEN ... END IF
- Use WHILE condition DO ... END WHILE
- Use FOR variable FROM start TO end DO ... END FOR
- Use REPEAT ... UNTIL condition
- Use SWITCH variable CASE value: ... DEFAULT: ... END SWITCH

### Functions and Procedures
- Use FUNCTION functionName(parameters) RETURNS dataType ... END FUNCTION
- Use PROCEDURE procedureName(parameters) ... END PROCEDURE
- Use CALL functionName(arguments) for function calls

### Variables and Operations
- Use SET variable = value for assignment
- Use DECLARE variable AS dataType for variable declaration
- Use INPUT variable for user input
- Use OUTPUT expression for displaying output
- Use READ filename TO variable for file operations
- Use WRITE variable TO filename for file operations

### Data Structures
- Use ARRAY arrayName[size] OF dataType
- Use LIST listName OF dataType
- Use DICTIONARY dictName OF keyType:valueType

### Logical Operators
- Use AND, OR, NOT for logical operations
- Use =, ≠, <, >, ≤, ≥ for comparisons

### Common Patterns
- Use INCREMENT variable instead of variable = variable + 1
- Use DECREMENT variable instead of variable = variable - 1
- Use APPEND item TO list for adding to lists
- Use REMOVE item FROM list for removing from lists

### Example Input/Output Format
When given code, respond with only the pseudocode using the above conventions:\n\n${code}`;

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