#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 파일별 올바른 import 경로 계산
function getCorrectImportPath(filePath) {
  const srcDir = path.join(__dirname, 'src');
  const relativePath = path.relative(srcDir, filePath);
  const depth = relativePath.split(path.sep).length - 1;
  
  if (depth === 0) {
    // src 루트 파일들 (App.jsx, index.jsx 등)
    return './utils/logger';
  } else {
    // 하위 디렉토리 파일들
    return '../'.repeat(depth) + 'utils/logger';
  }
}

// 파일 수정 함수
function fixImportPath(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 잘못된 logger import 찾기
    const wrongImportPattern = /import\s*{\s*createLogger\s*}\s*from\s*['"]\.\.\/utils\/logger['"];?\s*\n/g;
    
    if (wrongImportPattern.test(content)) {
      const correctPath = getCorrectImportPath(filePath);
      
      // 잘못된 import를 올바른 경로로 교체
      content = content.replace(
        /import\s*{\s*createLogger\s*}\s*from\s*['"]\.\.\/utils\/logger['"];?\s*\n/g,
        `import { createLogger } from '${correctPath}';\n`
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 수정됨: ${filePath} -> ${correctPath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ 오류 (${filePath}):`, error.message);
    return false;
  }
}

// 디렉토리 순회
function processDirectory(dirPath) {
  let fixedCount = 0;
  
  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build'].includes(item)) {
          continue;
        }
        walkDir(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
          if (fixImportPath(fullPath)) {
            fixedCount++;
          }
        }
      }
    }
  }
  
  walkDir(dirPath);
  return fixedCount;
}

// 메인 실행
function main() {
  const srcPath = path.join(__dirname, 'src');
  
  console.log('🔧 logger import 경로 수정 시작...');
  console.log(`📁 대상 디렉토리: ${srcPath}`);
  
  const fixedCount = processDirectory(srcPath);
  
  console.log(`\n✨ 완료! ${fixedCount}개 파일의 import 경로가 수정되었습니다.`);
}

if (require.main === module) {
  main();
}

module.exports = { fixImportPath, getCorrectImportPath }; 

const fs = require('fs');
const path = require('path');

// 파일별 올바른 import 경로 계산
function getCorrectImportPath(filePath) {
  const srcDir = path.join(__dirname, 'src');
  const relativePath = path.relative(srcDir, filePath);
  const depth = relativePath.split(path.sep).length - 1;
  
  if (depth === 0) {
    // src 루트 파일들 (App.jsx, index.jsx 등)
    return './utils/logger';
  } else {
    // 하위 디렉토리 파일들
    return '../'.repeat(depth) + 'utils/logger';
  }
}

// 파일 수정 함수
function fixImportPath(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 잘못된 logger import 찾기
    const wrongImportPattern = /import\s*{\s*createLogger\s*}\s*from\s*['"]\.\.\/utils\/logger['"];?\s*\n/g;
    
    if (wrongImportPattern.test(content)) {
      const correctPath = getCorrectImportPath(filePath);
      
      // 잘못된 import를 올바른 경로로 교체
      content = content.replace(
        /import\s*{\s*createLogger\s*}\s*from\s*['"]\.\.\/utils\/logger['"];?\s*\n/g,
        `import { createLogger } from '${correctPath}';\n`
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 수정됨: ${filePath} -> ${correctPath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ 오류 (${filePath}):`, error.message);
    return false;
  }
}

// 디렉토리 순회
function processDirectory(dirPath) {
  let fixedCount = 0;
  
  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build'].includes(item)) {
          continue;
        }
        walkDir(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(fullPath);
        if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
          if (fixImportPath(fullPath)) {
            fixedCount++;
          }
        }
      }
    }
  }
  
  walkDir(dirPath);
  return fixedCount;
}

// 메인 실행
function main() {
  const srcPath = path.join(__dirname, 'src');
  
  console.log('🔧 logger import 경로 수정 시작...');
  console.log(`📁 대상 디렉토리: ${srcPath}`);
  
  const fixedCount = processDirectory(srcPath);
  
  console.log(`\n✨ 완료! ${fixedCount}개 파일의 import 경로가 수정되었습니다.`);
}

if (require.main === module) {
  main();
}

module.exports = { fixImportPath, getCorrectImportPath }; 
 
 
 
 
 
 
 
 
 
 
 
 
 
 