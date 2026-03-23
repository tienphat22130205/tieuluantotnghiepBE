const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  // Vietnamese phone number format: 10 digits starting with 0
  const phoneRegex = /^0\d{9}$/;
  return phoneRegex.test(phone);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const validateUsername = (username) => {
  // Username: 3-20 characters, alphanumeric and underscore only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

const validateDateOfBirth = (dateOfBirth) => {
  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dob <= today;
};

const isAtLeastAge = (dateOfBirth, minAge = 13) => {
  if (!validateDateOfBirth(dateOfBirth)) {
    return false;
  }

  const dob = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= minAge;
};

module.exports = {
  validateEmail,
  validatePhone,
  validatePassword,
  validateUsername,
  validateDateOfBirth,
  isAtLeastAge,
};
