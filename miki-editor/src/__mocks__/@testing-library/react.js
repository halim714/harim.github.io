// 기존 RTL 기능 유지
const rtl = jest.requireActual('@testing-library/react');
// hooks 패키지에서 renderHook·act 가져오기
const hooks = require('@testing-library/react-hooks');
 
module.exports = {
  ...rtl,
  renderHook: hooks.renderHook,
  act: hooks.act,
}; 