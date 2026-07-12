export const getManualReportDeliveryOutcome = (responseData = {}) => {
  const delivery = responseData.delivery || responseData.reportData?.delivery;

  if (responseData.success !== true || delivery?.confirmed !== true) {
    return {
      confirmed: false,
      message:
        responseData.message ||
        delivery?.message ||
        "Report generated, but email delivery was not confirmed.",
    };
  }

  return {
    confirmed: true,
    message: responseData.message || delivery.message || "Report email delivered.",
  };
};
