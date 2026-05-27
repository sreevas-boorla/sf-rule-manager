import axios from 'axios';
import sfConfig from '../config/salesforce.js';

const toolingPath = (instanceUrl) =>
  `${instanceUrl}/services/data/${sfConfig.apiVersion}/tooling`;

export async function getValidationRules(instanceUrl, accessToken) {
  const soql = `SELECT Id, ValidationName, Active, Description, ErrorMessage, EntityDefinition.QualifiedApiName
    FROM ValidationRule
    WHERE EntityDefinition.QualifiedApiName = 'Account'`;

  const resp = await axios.get(`${toolingPath(instanceUrl)}/query`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q: soql },
  });

  return resp.data.records;
}

export async function getValidationRuleDetails(instanceUrl, accessToken, ruleId) {
  const resp = await axios.get(
    `${toolingPath(instanceUrl)}/sobjects/ValidationRule/${ruleId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return resp.data;
}

export async function getOrgName(instanceUrl, accessToken) {
  const resp = await axios.get(`${instanceUrl}/services/data/${sfConfig.apiVersion}/query`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q: 'SELECT Name FROM Organization LIMIT 1' },
  });
  return resp.data.records?.[0]?.Name || 'Unknown Org';
}
