export const RejectionReason = Object.freeze({
  CHECK_FAILED: "CHECK_FAILED",
  CHECKOUT_MISMATCH: "CHECKOUT_MISMATCH",
  WORKTREE_DIRTY: "WORKTREE_DIRTY",
  LOCKED_PATH_MISSING: "LOCKED_PATH_MISSING",
  LOCKED_PATH_CHANGED: "LOCKED_PATH_CHANGED",
  OUT_OF_SCOPE_CHANGE: "OUT_OF_SCOPE_CHANGE",
  LOCKED_HASH_CHANGED: "LOCKED_HASH_CHANGED",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
});

export const rejectionReasonLabels = Object.freeze({
  [RejectionReason.CHECK_FAILED]: "Check could not establish proof",
  [RejectionReason.CHECKOUT_MISMATCH]: "Checked-out commit does not match the requested head",
  [RejectionReason.WORKTREE_DIRTY]: "Workspace contains changes outside the requested head",
  [RejectionReason.LOCKED_PATH_MISSING]: "Configured locked contract is missing",
  [RejectionReason.LOCKED_PATH_CHANGED]: "Locked contract changed",
  [RejectionReason.OUT_OF_SCOPE_CHANGE]: "A file changed outside the allowed scope",
  [RejectionReason.LOCKED_HASH_CHANGED]: "Locked contract fingerprint changed",
  [RejectionReason.VERIFICATION_FAILED]: "Behavioral verification failed",
});
