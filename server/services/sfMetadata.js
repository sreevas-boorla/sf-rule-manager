import archiver from 'archiver';
import axios from 'axios';
import sfConfig from '../config/salesforce.js';

function buildObjectXml(ruleName, active, formula, errorMessage, errorDisplayField) {
  let ruleBody = `
        <fullName>${ruleName}</fullName>
        <active>${active}</active>
        <errorConditionFormula><![CDATA[${formula}]]></errorConditionFormula>
        <errorMessage>${escapeXml(errorMessage)}</errorMessage>`;

  if (errorDisplayField) {
    ruleBody += `\n        <errorDisplayField>${errorDisplayField}</errorDisplayField>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <validationRules>${ruleBody}
    </validationRules>
</CustomObject>`;
}

function buildPackageXml(objectName, ruleName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>${objectName}.${ruleName}</members>
        <name>ValidationRule</name>
    </types>
    <version>59.0</version>
</Package>`;
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Zip the package.xml + object file into a buffer using archiver
function createDeployZip(packageXml, objectXml) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    archive.append(packageXml, { name: 'package.xml' });
    archive.append(objectXml, { name: 'objects/Account.object' });
    archive.finalize();
  });
}

export async function deployRuleToggle(instanceUrl, accessToken, ruleMetadata, newActiveState) {
  const ruleName = ruleMetadata.ValidationName || ruleMetadata.FullName;
  const objectName = ruleMetadata.EntityDefinition?.QualifiedApiName || 'Account';

  const objectXml = buildObjectXml(
    ruleName,
    newActiveState,
    ruleMetadata.Metadata?.errorConditionFormula || ruleMetadata.ErrorConditionFormula || '',
    ruleMetadata.Metadata?.errorMessage || ruleMetadata.ErrorMessage || '',
    ruleMetadata.Metadata?.errorDisplayField || ruleMetadata.ErrorDisplayField || null
  );

  const packageXml = buildPackageXml(objectName, ruleName);
  const zipBuffer = await createDeployZip(packageXml, objectXml);

  // SF Metadata REST API expects multipart with a JSON part and the zip file
  const boundary = '----DeployBoundary' + Date.now();
  const deployOptions = JSON.stringify({
    deployOptions: {
      allowMissingFiles: false,
      autoUpdatePackage: false,
      checkOnly: false,
      singlePackage: true,
    },
  });

  // Build multipart body manually — avoids pulling in another dep
  const parts = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="json"\r\n',
    'Content-Type: application/json\r\n\r\n',
    deployOptions + '\r\n',
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="file"; filename="deploy.zip"\r\n',
    'Content-Type: application/zip\r\n\r\n',
  ];

  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, zipBuffer, footer]);

  const resp = await axios.post(
    `${instanceUrl}/services/data/${sfConfig.apiVersion}/metadata/deployRequest`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      maxBodyLength: Infinity,
    }
  );

  return resp.data;
}

export async function checkDeployStatus(instanceUrl, accessToken, deployId) {
  const resp = await axios.get(
    `${instanceUrl}/services/data/${sfConfig.apiVersion}/metadata/deployRequest/${deployId}`,
    {
      params: { includeDetails: true },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return resp.data;
}
