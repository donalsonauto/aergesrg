// Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
import http from './http';

// Rankmatic V2 Revenue Recovery API — GA4 traffic channels that previously
// drove real traffic but have gone dormant or severely declined. Auth is the
// express-session cookie (http.js sets withCredentials). Mirrors the unwrap()
// pattern used by SeoAPI / DashboardAPI.
function unwrap(response) {
  const body = response.data;
  return body?.data !== undefined ? body.data : body;
}

export default {
  // GA traffic-channel recovery analysis for the current scope (a fixed
  // 14-month lookback). Returns { connected, period, summary, opportunities }
  // or a soft { error } / { connected:false }.
  async getGaRecovery({ scopeType, scopeId } = {}) {
    return unwrap(await http.get('/recovery/ga', {
      params: { scopeType, scopeId },
    }));
  },
};
