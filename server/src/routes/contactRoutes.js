const express = require("express");
const {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} = require("../store/dataStore");

const contactRoutes = express.Router();

function getAuthenticatedUserId(req) {
  return req.authUser?.id || null;
}

// GET /contacts - fetch all contacts with optional filters
contactRoutes.get("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { name, email, company } = req.query;
    const contacts = await getContacts({ name, email, company }, { userId });
    res.json({ contacts });
  } catch (error) {
    console.error("[contacts:list]", error.message);
    res.status(500).json({ error: "Failed to fetch contacts", details: error.message });
  }
});

// POST /contacts - create new contact
contactRoutes.post("/", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { name, email, phone, company, role, linkedinUrl, notes } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Contact name is required" });
    }

    const contact = await createContact({
      name: name.trim(),
      email: email || null,
      phone: phone || null,
      company: company || null,
      role: role || null,
      linkedinUrl: linkedinUrl || null,
      notes: notes || null,
    }, { userId });

    res.json({ contact, message: "Contact created successfully" });
  } catch (error) {
    console.error("[contacts:create]", error.message);
    res.status(500).json({ error: "Failed to create contact", details: error.message });
  }
});

// PATCH /contacts/:id - update contact
contactRoutes.patch("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { name, email, phone, company, role, linkedinUrl, notes } = req.body;

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email;
    if (phone !== undefined) patch.phone = phone;
    if (company !== undefined) patch.company = company;
    if (role !== undefined) patch.role = role;
    if (linkedinUrl !== undefined) patch.linkedinUrl = linkedinUrl;
    if (notes !== undefined) patch.notes = notes;

    const contact = await updateContact(req.params.id, patch, { userId });

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json({ contact, message: "Contact updated successfully" });
  } catch (error) {
    console.error("[contacts:update]", error.message);
    res.status(500).json({ error: "Failed to update contact", details: error.message });
  }
});

// DELETE /contacts/:id - delete contact
contactRoutes.delete("/:id", async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);
    await deleteContact(req.params.id, { userId });
    res.json({ message: "Contact deleted successfully" });
  } catch (error) {
    console.error("[contacts:delete]", error.message);
    res.status(500).json({ error: "Failed to delete contact", details: error.message });
  }
});

module.exports = { contactRoutes };
