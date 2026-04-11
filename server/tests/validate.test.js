import { describe, it, expect } from "vitest";
import { authSchemas, jobSchemas, billingSchemas, adminSchemas, aiSchemas } from "../src/middleware/validate.js";

describe("authSchemas.register", () => {
  it("accepts valid registration", () => {
    const result = authSchemas.register.safeParse({
      email: "Test@Example.COM",
      password: "securepassword123",
      name: "Jane Doe",
    });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe("test@example.com");
  });

  it("rejects missing email", () => {
    const result = authSchemas.register.safeParse({
      password: "securepassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = authSchemas.register.safeParse({
      email: "a@b.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("authSchemas.login", () => {
  it("accepts valid credentials", () => {
    const result = authSchemas.login.safeParse({
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = authSchemas.login.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("authSchemas.mfaCode", () => {
  it("accepts 6-digit code", () => {
    const result = authSchemas.mfaCode.safeParse({ code: "123456" });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric code", () => {
    const result = authSchemas.mfaCode.safeParse({ code: "abc123" });
    expect(result.success).toBe(false);
  });

  it("rejects too-short code", () => {
    const result = authSchemas.mfaCode.safeParse({ code: "123" });
    expect(result.success).toBe(false);
  });
});

describe("jobSchemas.create", () => {
  it("accepts valid job", () => {
    const result = jobSchemas.create.safeParse({
      company: "Acme Corp",
      role: "Software Engineer",
      status: "Applied",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing company", () => {
    const result = jobSchemas.create.safeParse({
      role: "Software Engineer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const result = jobSchemas.create.safeParse({
      company: "Acme Corp",
    });
    expect(result.success).toBe(false);
  });
});

describe("billingSchemas.checkout", () => {
  it("accepts valid tier", () => {
    expect(billingSchemas.checkout.safeParse({ tier: "pro" }).success).toBe(true);
    expect(billingSchemas.checkout.safeParse({ tier: "elite" }).success).toBe(true);
  });

  it("rejects invalid tier", () => {
    expect(billingSchemas.checkout.safeParse({ tier: "free" }).success).toBe(false);
    expect(billingSchemas.checkout.safeParse({ tier: "admin" }).success).toBe(false);
  });
});

describe("adminSchemas.updateRole", () => {
  it("accepts valid roles", () => {
    for (const role of ["free", "pro", "elite", "admin"]) {
      expect(adminSchemas.updateRole.safeParse({ role }).success).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    expect(adminSchemas.updateRole.safeParse({ role: "superadmin" }).success).toBe(false);
  });
});

describe("aiSchemas.coverLetter", () => {
  it("accepts valid input", () => {
    const result = aiSchemas.coverLetter.safeParse({
      jobTitle: "Engineer",
      company: "Acme",
      jobDescription: "Build things",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty jobTitle", () => {
    const result = aiSchemas.coverLetter.safeParse({
      jobTitle: "",
      company: "Acme",
      jobDescription: "Build things",
    });
    expect(result.success).toBe(false);
  });
});
