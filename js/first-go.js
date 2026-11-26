/**
 * First-go tracking.
 *
 * The server identifies the first saved score for each name, game and UTC day.
 * Browser-based localStorage attempt tracking is disabled.
 */
(function () {
  'use strict';

  /**
   * Marker per row of a table already sorted best-first.
   */
  function markersFor(rows) {
    const list = Array.isArray(rows) ? rows : [];
    let crownGiven = false;
    return list.map((entry) => {
      if (!entry || entry.first_go !== true) return '';
      if (!crownGiven) {
        crownGiven = true;
        return '\uD83C\uDFC6';
      }
      return '1\uFE0F\u20E3';
    });
  }

  window.WSFirstGo = {
    markersFor: markersFor,
    legend: '\uD83C\uDFC6 best first submission   1\uFE0F\u20E3 first submission of the day'
  };
})();
