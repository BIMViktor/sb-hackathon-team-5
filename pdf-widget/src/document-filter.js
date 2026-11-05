export function isCalibratedPdf(document) {
  return (
    !!document &&
    document.attributes?.["is-deleted"] !== true &&
    /\.pdf$/i.test(document.attributes?.filename || "") &&
    Array.isArray(document.relationships?.["document-alignments"]?.data) &&
    document.relationships["document-alignments"].data.length > 0
  );
}
