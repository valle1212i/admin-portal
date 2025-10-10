// services/externalIntegrations.js
// Stubbed external integrations for future implementation

/**
 * TODO: Integrate with Bolagsverket API
 * API Documentation: https://www.bolagsverket.se/
 * 
 * Lookup Swedish organization number to auto-fill company data
 */
async function lookupOrgNumber(orgNumber) {
  console.log(`[STUB] Looking up organization number: ${orgNumber}`);
  
  // Mock response - replace with actual API call
  return {
    success: true,
    data: {
      organizationNumber: orgNumber,
      companyName: `Example AB ${orgNumber.slice(-4)}`,
      legalEntityType: 'Aktiebolag',
      registrationDate: '2020-01-15',
      address: {
        street: 'Exempelgatan 123',
        postalCode: '123 45',
        city: 'Stockholm',
        country: 'Sverige'
      },
      status: 'active'
    }
  };
}

/**
 * TODO: Integrate with VIES (VAT Information Exchange System)
 * API Documentation: https://ec.europa.eu/taxation_customs/vies/
 * 
 * Validate EU VAT numbers
 */
async function validateVAT(vatNumber, countryCode = 'SE') {
  console.log(`[STUB] Validating VAT number: ${countryCode}${vatNumber}`);
  
  // Mock response - replace with actual VIES API call
  return {
    success: true,
    valid: true,
    countryCode,
    vatNumber,
    requestDate: new Date(),
    name: 'Example Company AB',
    address: 'Exempelgatan 123, 123 45 Stockholm'
  };
}

/**
 * TODO: Integrate with BankID
 * API Documentation: https://www.bankid.com/utvecklare/
 * 
 * Initiate BankID authentication for identity verification
 */
async function initiateBankID(personalNumber, endUserIp) {
  console.log(`[STUB] Initiating BankID for personal number: ${personalNumber}`);
  
  // Mock response - replace with actual BankID API call
  return {
    success: true,
    orderRef: `mock-order-${Date.now()}`,
    autoStartToken: `mock-token-${Date.now()}`,
    qrStartToken: `mock-qr-${Date.now()}`,
    qrStartSecret: `mock-secret-${Date.now()}`
  };
}

/**
 * TODO: Poll BankID status
 */
async function collectBankID(orderRef) {
  console.log(`[STUB] Collecting BankID status for order: ${orderRef}`);
  
  // Mock response - replace with actual BankID collect call
  return {
    success: true,
    status: 'complete',
    completionData: {
      user: {
        personalNumber: '198001011234',
        name: 'Test Testsson',
        givenName: 'Test',
        surname: 'Testsson'
      },
      signature: 'mock-signature-data'
    }
  };
}

/**
 * TODO: Integrate with Stripe
 * API Documentation: https://stripe.com/docs/api
 * 
 * Create Stripe customer for payment processing
 */
async function createStripeCustomer(onboarding) {
  console.log(`[STUB] Creating Stripe customer for: ${onboarding.companyName}`);
  
  // Mock response - replace with actual Stripe API call
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // const customer = await stripe.customers.create({
  //   name: onboarding.companyName,
  //   email: onboarding.email,
  //   metadata: {
  //     organizationNumber: onboarding.organizationNumber,
  //     onboardingId: onboarding._id.toString()
  //   }
  // });
  
  return {
    success: true,
    customerId: `cus_mock_${Date.now()}`,
    object: 'customer',
    created: Math.floor(Date.now() / 1000),
    email: onboarding.email,
    name: onboarding.companyName
  };
}

/**
 * TODO: Create Stripe subscription
 */
async function createStripeSubscription(customerId, priceId) {
  console.log(`[STUB] Creating Stripe subscription for customer: ${customerId}`);
  
  // Mock response
  return {
    success: true,
    subscriptionId: `sub_mock_${Date.now()}`,
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
  };
}

/**
 * Validate Swedish organization number format
 * This is a real validation that can be used
 */
function validateSwedishOrgNumber(orgNumber) {
  // Remove any spaces or dashes
  const cleaned = orgNumber.replace(/[\s-]/g, '');
  
  // Should be 10 digits
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: 'Organisationsnummer måste vara 10 siffror' };
  }
  
  // Luhn algorithm check (modulus 10)
  const digits = cleaned.split('').map(Number);
  let sum = 0;
  
  for (let i = 0; i < 9; i++) {
    let digit = digits[i];
    
    // Every second digit from the right (starting with the second last)
    if ((9 - i) % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  
  if (checkDigit !== digits[9]) {
    return { valid: false, error: 'Ogiltigt organisationsnummer (checksumma matchar inte)' };
  }
  
  return { valid: true };
}

/**
 * Validate IBAN format (basic check)
 */
function validateIBAN(iban) {
  // Remove spaces
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  
  // Swedish IBAN: SE + 2 check digits + 20 digits
  if (cleaned.startsWith('SE')) {
    if (cleaned.length !== 24) {
      return { valid: false, error: 'Svenskt IBAN ska vara 24 tecken' };
    }
  }
  
  // Basic format check: 2 letters + 2 digits + alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) {
    return { valid: false, error: 'Ogiltigt IBAN-format' };
  }
  
  return { valid: true, formatted: cleaned };
}

module.exports = {
  lookupOrgNumber,
  validateVAT,
  initiateBankID,
  collectBankID,
  createStripeCustomer,
  createStripeSubscription,
  validateSwedishOrgNumber,
  validateIBAN
};

