const User = require('./auth.model');
const { ROLES } = require('../../constants');

const seedDefaultAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminUsername = process.env.ADMIN_USERNAME || 'superadmin';
    const adminPhone = process.env.ADMIN_PHONE || '0900000000';

    if (!adminEmail || !adminPassword) {
      console.warn('Skip seeding admin: missing ADMIN_EMAIL or ADMIN_PASSWORD in .env');
      return;
    }

    const normalizedEmail = adminEmail.toLowerCase().trim();
    let adminUser = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!adminUser) {
      adminUser = new User({
        username: adminUsername,
        email: normalizedEmail,
        phone: adminPhone,
        password: adminPassword,
        role: ROLES.ADMIN,
        verified: true,
        isActive: true,
      });

      await adminUser.save();
      console.log(`Default admin created: ${normalizedEmail}`);
      return;
    }

    let hasChanges = false;

    if (adminUser.role !== ROLES.ADMIN) {
      adminUser.role = ROLES.ADMIN;
      hasChanges = true;
    }

    if (!adminUser.verified) {
      adminUser.verified = true;
      hasChanges = true;
    }

    if (!adminUser.isActive) {
      adminUser.isActive = true;
      hasChanges = true;
    }

    if (hasChanges) {
      await adminUser.save();
      console.log(`Default admin updated: ${normalizedEmail}`);
    } else {
      console.log(`Default admin already ready: ${normalizedEmail}`);
    }
  } catch (error) {
    console.error('Seed admin error:', error.message);
  }
};

module.exports = seedDefaultAdmin;
