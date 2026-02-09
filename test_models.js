const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

async function main() {
  // Try to read env file
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    try {
      const envContent = fs.readFileSync(path.resolve(__dirname, 'prod.env'), 'utf8');
      const match = envContent.match(/GEMINI_API_KEY=(.*)/);
      if (match) {
        apiKey = match[1].trim();
      }
    } catch (e) {
      console.log('Could not read prod.env');
    }
  }

  if (!apiKey) {
    console.error('No GEMINI_API_KEY found');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // There isn't a direct listModels method on the client instance in the node SDK generally,
  // we usually have to use the model manager or just try. 
  // But let's try to list if possible, or test the model directly.
  
  try {
      // Try to fetch a list using raw fetch if possible or just log error detailed
      // The SDK hides the list models capability in GoogleGenerativeAI class usually
      // but maybe we can use the model manager
  } catch(e) {}

  console.log(`Testing model: gemini-1.5-flash-latest`);
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    const result = await model.generateContent('Hello');
    console.log('Success!', result.response.text());
  } catch (e) {
    console.error('Error with gemini-1.5-flash-latest:', e.message);
  }

  console.log(`\nTesting model: gemini-pro`);
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('Hello');
    console.log('Success!', result.response.text());
  } catch (e) {
    console.error('Error with gemini-pro:', e.message);
  }
}

main();
