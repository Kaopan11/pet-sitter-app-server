export const validateUpdateOwners = (req, res, next) => {
    const { name, email, phone, id_number, date_of_birth } = req.body ?? {};

    if (!name?.trim()) {
        return res.status(400).json({ message: "Name is required" });
    } 

    if (!email?.trim()) {
      return res.status(400).json({ message: "Email is required" });
    } else if (!/^[^\s@]+@[^\s@]+\.com$/i.test(email.trim())) {
        return res.status(400).json({ message: "Invalid email address" });
    }

    if (!phone?.trim()) {
      return res.status(400).json({ message: "Phone is required" });
    } else if (!/^0\d{9}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number" });
    }

    if (!id_number?.trim()) {
      return res.status(400).json({ message: "ID number is required" });
    } else if (!/^\d{13}$/.test(id_number.trim())) {
        return res.status(400).json({ message: "ID number must be 13 digits" });
    }
    
    if (!date_of_birth || !String(date_of_birth).trim()) {
        return res.status(400).json({ message: "Date of birth is required" });
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
        return res.status(400).json({ message: "Date of birth must be in YYYY-MM-DD format" });
    }
    
    next();
  };