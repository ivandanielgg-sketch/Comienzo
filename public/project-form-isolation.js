(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProjectFormIsolation = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function hasNonZeroAmount(amount) {
    const value = Number(amount);
    return Number.isFinite(value) && Math.abs(value) > 0.000001;
  }

  function isPaymentDraftDirty({ amount, notes, paymentDate, todayDate }) {
    if (hasNonZeroAmount(amount)) return true;
    if (String(notes || '').trim()) return true;
    const date = String(paymentDate || '').trim();
    if (date && date !== String(todayDate || '').trim()) return true;
    return false;
  }

  function isCostDraftDirty({ amount, description, costDate, todayDate }) {
    if (hasNonZeroAmount(amount)) return true;
    if (String(description || '').trim()) return true;
    const date = String(costDate || '').trim();
    if (date && date !== String(todayDate || '').trim()) return true;
    return false;
  }

  function isUnsavedMovementDraftDirty(payment, cost, todayDate) {
    return isPaymentDraftDirty({ ...payment, todayDate }) || isCostDraftDirty({ ...cost, todayDate });
  }

  function isProjectDetailLoadCurrent(state, token, projectId) {
    return (
      Number(state.projectDetailLoadToken) === Number(token)
      && Number(state.selectedProjectId) === Number(projectId)
    );
  }

  function nextProjectDetailLoadToken(currentToken) {
    const base = Number(currentToken);
    return (Number.isFinite(base) ? base : 0) + 1;
  }

  return {
    hasNonZeroAmount,
    isPaymentDraftDirty,
    isCostDraftDirty,
    isUnsavedMovementDraftDirty,
    isProjectDetailLoadCurrent,
    nextProjectDetailLoadToken,
  };
});
