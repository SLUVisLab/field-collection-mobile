const { proxyRequest } = require('../services/mongodb');

// Allowlist of safe read-only operations
const ALLOWED_ACTIONS = ['find', 'findOne', 'aggregate'];

exports.proxyRequest = async (req, res) => {
  try {
    const action = req.params.action;
    
    // Security check - only allow safe read operations
    if (!ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({ 
        error: `Operation '${action}' not allowed. Allowed operations: ${ALLOWED_ACTIONS.join(', ')}` 
      });
    }
    
    const result = await proxyRequest(action, req.body);
    return res.json(result);
  } catch (error) {
    console.error(`MongoDB proxy error: ${error.message}`);
    return res.status(error.status || 500).json({ error: error.message });
  }
};