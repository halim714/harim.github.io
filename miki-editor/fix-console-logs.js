#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 교체할 패턴들
const replacements = [
  // console.log -> logger.info
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.info('
  },
  // console.error -> logger.error  
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error('
  },
  // console.warn -> logger.warn
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn('
  },
  // console.debug -> logger.debug
  {
    pattern: /console\.debug\(/g,
    replacement: 'logger.debug('
  }
];

// logger import 추가 패턴
const loggerImportPattern = /^import.*from.*['"].*logger.*['"];?$/m;
const createLoggerImport = (filename) => {
  const name = path.basename(filename, path.extname(filename));
  return `import { createLogger } from '../utils/logger';\n\nconst logger = createLogger('${name}');\n`;
};

// 파일 처리 함수
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // console 사용이 있는지 확인
    const hasConsole = /console\.(log|error|warn|debug)\(/g.test(content);
    
    if (!hasConsole) {
      return false; // 변경 없음
    }
    
    // logger import가 이미 있는지 확인
    const hasLoggerImport = loggerImportPattern.test(content) || 
                           content.includes('createLogger') ||
                           content.includes('const logger');
    
    // logger import 추가 (없는 경우만)
    if (!hasLoggerImport) {
      // 첫 번째 import 문 찾기
      const importMatch = content.match(/^import.*$/m);
      if (importMatch) {
        const importIndex = content.indexOf(importMatch[0]);
        const beforeImport = content.substring(0, importIndex);
        const afterImport = content.substring(importIndex);
        
        content = beforeImport + createLoggerImport(filePath) + afterImport;
        modified = true;
      } else {
        // import가 없으면 파일 시작에 추가
        content = createLoggerImport(filePath) + content;
        modified = true;
      }
    }
    
    // console 호출 교체
    for (const { pattern, replacement } of replacements) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 수정됨: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ 오류 (${filePath}):`, error.message);
    return false;
  }
}

// 디렉토리 순회 함수
function processDirectory(dirPath, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
  let processedCount = 0;
  
  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 제외할 디렉토리
        if (['node_modules', '.git', 'dist', 'build', '__tests__'].includes(item)) {
          continue;
        }
        walkDir(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (extensions.includes(ext)) {
          if (processFile(fullPath)) {
            processedCount++;
          }
        }
      }
    }
  }
  
  walkDir(dirPath);
  return processedCount;
}

// 메인 실행
function main() {
  const srcPath = path.join(__dirname, 'src');
  
  if (!fs.existsSync(srcPath)) {
    console.error('❌ src 디렉토리를 찾을 수 없습니다.');
    process.exit(1);
  }
  
  console.log('🚀 console.log -> logger 대량 교체 시작...');
  console.log(`📁 대상 디렉토리: ${srcPath}`);
  
  const processedCount = processDirectory(srcPath);
  
  console.log(`\n✨ 완료! ${processedCount}개 파일이 수정되었습니다.`);
  console.log('\n다음 단계:');
  console.log('1. npm run lint:check 로 결과 확인');
  console.log('2. npm test 로 테스트 실행');
  console.log('3. npm run build 로 빌드 확인');
}

if (require.main === module) {
  main();
}

module.exports = { processFile, processDirectory }; 

const fs = require('fs');
const path = require('path');

// 교체할 패턴들
const replacements = [
  // console.log -> logger.info
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.info('
  },
  // console.error -> logger.error  
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error('
  },
  // console.warn -> logger.warn
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn('
  },
  // console.debug -> logger.debug
  {
    pattern: /console\.debug\(/g,
    replacement: 'logger.debug('
  }
];

// logger import 추가 패턴
const loggerImportPattern = /^import.*from.*['"].*logger.*['"];?$/m;
const createLoggerImport = (filename) => {
  const name = path.basename(filename, path.extname(filename));
  return `import { createLogger } from '../utils/logger';\n\nconst logger = createLogger('${name}');\n`;
};

// 파일 처리 함수
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // console 사용이 있는지 확인
    const hasConsole = /console\.(log|error|warn|debug)\(/g.test(content);
    
    if (!hasConsole) {
      return false; // 변경 없음
    }
    
    // logger import가 이미 있는지 확인
    const hasLoggerImport = loggerImportPattern.test(content) || 
                           content.includes('createLogger') ||
                           content.includes('const logger');
    
    // logger import 추가 (없는 경우만)
    if (!hasLoggerImport) {
      // 첫 번째 import 문 찾기
      const importMatch = content.match(/^import.*$/m);
      if (importMatch) {
        const importIndex = content.indexOf(importMatch[0]);
        const beforeImport = content.substring(0, importIndex);
        const afterImport = content.substring(importIndex);
        
        content = beforeImport + createLoggerImport(filePath) + afterImport;
        modified = true;
      } else {
        // import가 없으면 파일 시작에 추가
        content = createLoggerImport(filePath) + content;
        modified = true;
      }
    }
    
    // console 호출 교체
    for (const { pattern, replacement } of replacements) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 수정됨: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ 오류 (${filePath}):`, error.message);
    return false;
  }
}

// 디렉토리 순회 함수
function processDirectory(dirPath, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
  let processedCount = 0;
  
  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 제외할 디렉토리
        if (['node_modules', '.git', 'dist', 'build', '__tests__'].includes(item)) {
          continue;
        }
        walkDir(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (extensions.includes(ext)) {
          if (processFile(fullPath)) {
            processedCount++;
          }
        }
      }
    }
  }
  
  walkDir(dirPath);
  return processedCount;
}

// 메인 실행
function main() {
  const srcPath = path.join(__dirname, 'src');
  
  if (!fs.existsSync(srcPath)) {
    console.error('❌ src 디렉토리를 찾을 수 없습니다.');
    process.exit(1);
  }
  
  console.log('🚀 console.log -> logger 대량 교체 시작...');
  console.log(`📁 대상 디렉토리: ${srcPath}`);
  
  const processedCount = processDirectory(srcPath);
  
  console.log(`\n✨ 완료! ${processedCount}개 파일이 수정되었습니다.`);
  console.log('\n다음 단계:');
  console.log('1. npm run lint:check 로 결과 확인');
  console.log('2. npm test 로 테스트 실행');
  console.log('3. npm run build 로 빌드 확인');
}

if (require.main === module) {
  main();
}

module.exports = { processFile, processDirectory }; 
 
 
 
 
 
 
 
 
 
 
 
 
 
 