import { Router } from 'express';
import authCheck from '../middleware/authCheck.js';
import { getValidationRules, getValidationRuleDetails } from '../services/sfTooling.js';
import { deployRuleToggle, checkDeployStatus } from '../services/sfMetadata.js';

const router = Router();

router.use(authCheck);

// Normalize the SF field names into something the frontend actually wants
function normalizeRule(record) {
  return {
    id: record.Id,
    name: record.ValidationName,
    fullName: record.ValidationName,
    active: record.Active,
    description: record.Description || null,
    errorMessage: record.ErrorMessage || null,
    objectName: record.EntityDefinition?.QualifiedApiName || 'Account',
  };
}

router.get('/', async (req, res) => {
  const { accessToken, instanceUrl } = req.session.sf;
  try {
    const records = await getValidationRules(instanceUrl, accessToken);
    const rules = records.map(normalizeRule);
    res.json({ rules });
  } catch (err) {
    console.error('Failed to fetch rules:', err.response?.data || err.message);
    res.status(502).json({
      error: 'Failed to fetch validation rules — check if your session is still valid',
    });
  }
});

router.put('/:fullName/toggle', async (req, res) => {
  const { accessToken, instanceUrl } = req.session.sf;
  const { fullName } = req.params;

  try {
    // First grab existing rules to find this one by name
    const records = await getValidationRules(instanceUrl, accessToken);
    const rule = records.find((r) => r.ValidationName === fullName);
    if (!rule) {
      return res.status(404).json({ error: `Rule "${fullName}" not found on Account` });
    }

    // Need full metadata (formula etc.) to redeploy
    const details = await getValidationRuleDetails(instanceUrl, accessToken, rule.Id);
    const newState = !details.Metadata?.active;

    const deployResult = await deployRuleToggle(instanceUrl, accessToken, details, newState);
    res.json({
      message: `Deploy started — toggling "${fullName}" to ${newState ? 'active' : 'inactive'}`,
      deployId: deployResult.id,
    });
  } catch (err) {
    console.error('Toggle deploy failed:', err.response?.data || err.message);
    res.status(502).json({ error: 'Failed to deploy rule toggle — see server logs for details' });
  }
});

router.get('/deploy-status/:id', async (req, res) => {
  const { accessToken, instanceUrl } = req.session.sf;
  try {
    const result = await checkDeployStatus(instanceUrl, accessToken, req.params.id);

    // Flatten the response so the frontend doesn't need to dig into nested objects
    const deploy = result.deployResult || result;
    res.json({
      done: deploy.done || false,
      success: deploy.status === 'Succeeded',
      status: deploy.status,
      error: deploy.errorMessage || null,
    });
  } catch (err) {
    console.error('Deploy status check failed:', err.response?.data || err.message);
    res.status(502).json({ error: 'Could not check deploy status' });
  }
});

export default router;
