(function () {
  const DEV_UNLOCK_ALL = true; // Set to false before production deployment.

  window.RDADevelopmentAccess = {
    DEV_UNLOCK_ALL,
    isEnabled() {
      return DEV_UNLOCK_ALL === true;
    },
  };
})();
