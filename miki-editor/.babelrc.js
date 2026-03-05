// Jest 환경에서 import.meta를 { env: process.env }로 변환
// Vite에서는 이 플러그인이 적용되지 않으므로 프로덕션 동작에 영향 없음
function transformImportMeta({ types: t }) {
  return {
    visitor: {
      MetaProperty(path) {
        if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
          path.replaceWith(
            t.objectExpression([
              t.objectProperty(
                t.identifier('env'),
                t.memberExpression(t.identifier('process'), t.identifier('env'))
              )
            ])
          );
        }
      }
    }
  };
}

module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
      },
    }],
    ['@babel/preset-react', {
      runtime: 'automatic',
    }],
  ],
  plugins: [
    '@babel/plugin-syntax-jsx',
    ...(process.env.NODE_ENV === 'test' ? [transformImportMeta] : []),
  ],
}; 