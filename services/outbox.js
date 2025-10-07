// services/outbox.js
const OutboundMessage = require('../models/OutboundMessage');

async function enqueueOutbound({ kind, url, body, headers = {} }) {
  return OutboundMessage.create({ kind, url, body, headers });
}

module.exports = { enqueueOutbound };
