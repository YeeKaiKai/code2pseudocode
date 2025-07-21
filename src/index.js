const readline = require('readline');
const { codeToPseudocode } = require('./claudeApi');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('請輸入你要轉換的程式碼（結束請輸入空行）：');
let codeLines = [];

rl.on('line', (line) => {
    if (line.trim() === '') {
        rl.close();
    } else {
        codeLines.push(line);
    }
});

rl.on('close', async () => {
    const code = codeLines.join('\n');
    if (!code) {
        console.log('未輸入任何程式碼，程式結束。');
        process.exit(0);
    }
    try {
        console.log('\n正在呼叫 Claude API，請稍候...');
        const pseudocode = await codeToPseudocode(code);
        console.log('\n--- Claude 產生的 pseudocode ---\n');
        console.log(pseudocode);
    } catch (err) {
        console.error('發生錯誤：', err.message);
    }
}); 