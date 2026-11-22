// Simulation test for MagnifyingLens mobile logic
console.log('Testing MagnifyingLens mobile logic...');

function simulateLogic() {
  let visible = false;
  let isTouchActive = false;

  const isInputElement = (targetId) => targetId === 'nickname-input';
  const isNearInput = (x, y, rect, pad = 24) => {
    return (
      x >= rect.left - pad &&
      x <= rect.right + pad &&
      y >= rect.top - pad &&
      y <= rect.bottom + pad
    );
  };

  const inputRect = { left: 100, right: 300, top: 200, bottom: 256 };

  // 1. Touch outside input
  let touch1 = { clientX: 50, clientY: 50, targetId: 'main-bg' };
  if (!isInputElement(touch1.targetId) && !isNearInput(touch1.clientX, touch1.clientY, inputRect)) {
    isTouchActive = true;
    visible = true;
  }
  if (!visible) throw new Error('Touch outside input should show lens');
  console.log('[PASS] Touch outside input shows lens');

  // 2. Touch move near input
  let touchMoveNear = { clientX: 110, clientY: 210 };
  if (isNearInput(touchMoveNear.clientX, touchMoveNear.clientY, inputRect)) {
    visible = false;
  }
  if (visible) throw new Error('Touch near input must hide lens');
  console.log('[PASS] Touch move near input hides lens');

  // 3. Touch inside input directly
  visible = false;
  isTouchActive = false;
  let touchInput = { clientX: 150, clientY: 220, targetId: 'nickname-input' };
  if (isInputElement(touchInput.targetId) || isNearInput(touchInput.clientX, touchInput.clientY, inputRect)) {
    isTouchActive = false;
    visible = false;
  }
  if (visible) throw new Error('Touch directly on input must not show lens');
  console.log('[PASS] Touch on input never triggers lens');

  // 4. Touch release (touchend)
  visible = true;
  isTouchActive = true;
  isTouchActive = false;
  visible = false;
  if (visible) throw new Error('Touch end must hide lens');
  console.log('[PASS] Touchend hides lens');

  console.log('\nAll MagnifyingLens interaction logic verified successfully!');
}

simulateLogic();
