import assert from "node:assert/strict";
import { afterEach, before, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const SITTER_ID = "sitter-user-1";

const findByUserId = mock.fn();
const isPhoneTaken = mock.fn(async () => false);
const isEmailTaken = mock.fn(async () => false);
const savePending = mock.fn(async () => {});
const uploadImageFile = mock.fn(async (_file, folder) => {
  return `https://cdn.example.com/${folder}/mock.jpg`;
});

mock.module("../repositories/sitterProfileMe.repository.mjs", {
  namedExports: {
    sitterProfileMeRepository: {
      findByUserId,
      isPhoneTaken,
      isEmailTaken,
      savePending,
    },
  },
});

mock.module("../utils/supabaseImageUpload.mjs", {
  namedExports: {
    uploadImageFile,
  },
});

const { sittersService } = await import("./sitters.service.mjs");
const { uploadSitterImages } = await import("../middlewares/uploadSitterImages.mjs");

function yearsAgo(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function validBasicFields() {
  return {
    name: "Kai Cenat",
    experience_years: "5+",
    phone: "0814568779",
    email: "sitter8@test.com",
    date_of_birth: "2002-04-02",
    id_number: "1103700123451",
    introduction: "Yo, nice to meet you bro",
  };
}

function lockedProfile(overrides = {}) {
  return {
    user_id: SITTER_ID,
    approval_status: "Unverified",
    pending_profile: null,
    avatar_url: null,
    sitter_photos: [],
    pet_types: [],
    name: "Old Name",
    phone: "0811111111",
    email: "old@test.com",
    ...overrides,
  };
}

function unlockedProfile(overrides = {}) {
  return lockedProfile({
    approval_status: "Verified",
    display_name: "Old Shop",
    address_detail: "Old address",
    province: "Bangkok",
    ...overrides,
  });
}

function createTestApp({ user = { id: SITTER_ID }, isSitter = true } = {}) {
  const app = express();

  const requireAuth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  };

  const requireSitter = (req, res, next) => {
    if (!isSitter) {
      return res
        .status(403)
        .json({ message: "Forbidden: You are not a sitter" });
    }
    next();
  };

  app.get("/api/sitters/me", requireAuth, requireSitter, async (req, res, next) => {
    try {
      const profile = await sittersService.getProfileByUserId(req.user.id);
      return res.status(200).json({ data: profile });
    } catch (error) {
      next(error);
    }
  });

  app.put(
    "/api/sitters/me",
    uploadSitterImages,
    requireAuth,
    requireSitter,
    async (req, res, next) => {
      try {
        await sittersService.updateMyProfile(req.user.id, {
          body: req.body,
          avatarFile: req.files?.imageFile?.[0],
          galleryFiles: req.files?.galleryFiles ?? [],
        });
        return res.status(200).json({ message: "Profile updated successfully" });
      } catch (error) {
        next(error);
      }
    }
  );

  app.use((error, _req, res, _next) => {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || "Internal Server Error" });
  });

  return app;
}

function putBasic(app, fields = validBasicFields(), token = "sitter-token") {
  const req = request(app).put("/api/sitters/me");
  if (token) req.set("Authorization", `Bearer ${token}`);
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) req.field(key, String(value));
  }
  return req;
}

describe("GET /api/sitters/me (integration)", () => {
  before(() => {
    findByUserId.mock.resetCalls();
    findByUserId.mock.mockImplementation(async () => lockedProfile());
  });

  afterEach(() => {
    findByUserId.mock.resetCalls();
    findByUserId.mock.mockImplementation(async () => lockedProfile());
  });

  it("Happy Path: returns sitter profile", async () => {
    const app = createTestApp();
    const res = await request(app)
      .get("/api/sitters/me")
      .set("Authorization", "Bearer sitter-token");

    assert.equal(res.status, 200);
    assert.ok(res.body.data);
    assert.equal(findByUserId.mock.callCount(), 1);
  });

  it("Exception Path: missing Authorization", async () => {
    const app = createTestApp();
    const res = await request(app).get("/api/sitters/me");
    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Unauthorized");
  });

  it("Exception Path: user is not a sitter", async () => {
    const app = createTestApp({ isSitter: false });
    const res = await request(app)
      .get("/api/sitters/me")
      .set("Authorization", "Bearer owner-token");

    assert.equal(res.status, 403);
    assert.equal(res.body.message, "Forbidden: You are not a sitter");
  });

  it("Exception Path: sitter profile not found", async () => {
    findByUserId.mock.mockImplementation(async () => null);
    const app = createTestApp();
    const res = await request(app)
      .get("/api/sitters/me")
      .set("Authorization", "Bearer sitter-token");

    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Sitter profile not found");
  });
});

describe("PUT /api/sitters/me (integration)", () => {
  afterEach(() => {
    findByUserId.mock.resetCalls();
    isPhoneTaken.mock.resetCalls();
    isEmailTaken.mock.resetCalls();
    savePending.mock.resetCalls();
    uploadImageFile.mock.resetCalls();

    findByUserId.mock.mockImplementation(async () => lockedProfile());
    isPhoneTaken.mock.mockImplementation(async () => false);
    isEmailTaken.mock.mockImplementation(async () => false);
    savePending.mock.mockImplementation(async () => {});
    uploadImageFile.mock.mockImplementation(
      async (_file, folder) => `https://cdn.example.com/${folder}/mock.jpg`
    );
  });

  it("Happy Path: updates basic information into pending_profile", async () => {
    const app = createTestApp();
    const res = await putBasic(app);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Profile updated successfully");
    assert.equal(savePending.mock.callCount(), 1);

    const [userId, pending, status] = savePending.mock.calls[0].arguments;
    assert.equal(userId, SITTER_ID);
    assert.equal(pending.full_name, "Kai Cenat");
    assert.equal(pending.phone, "0814568779");
    assert.equal(pending.id_number, "1103700123451");
    assert.equal(pending.date_of_birth, "2002-04-02");
    assert.equal(status, "Waiting for verify");
  });

  it("Happy Path: updates full profile when unlocked", async () => {
    findByUserId.mock.mockImplementation(async () => unlockedProfile());
    const app = createTestApp();

    const res = await putBasic(app, {
      ...validBasicFields(),
      display_name: "Kai Cenat",
      pet_types: "Dog",
      address_detail: "123 Road",
      district: "Watthana",
      sub_district: "Khlong Toei Nuea",
      province: "Bangkok",
      post_code: "10110",
      latitude: "13.75",
      longitude: "100.5",
    });

    assert.equal(res.status, 200);
    const [, pending, status] = savePending.mock.calls[0].arguments;
    assert.equal(pending.display_name, "Kai Cenat");
    assert.deepEqual(pending.pet_types, ["Dog"]);
    assert.equal(pending.province, "Bangkok");
    assert.equal(status, "Waiting for approve");
  });

  it("Happy Path: uploads profile image", async () => {
    const app = createTestApp();
    const res = await request(app)
      .put("/api/sitters/me")
      .set("Authorization", "Bearer sitter-token")
      .field("name", "Kai Cenat")
      .field("experience_years", "5+")
      .field("phone", "0814568779")
      .field("email", "sitter8@test.com")
      .field("date_of_birth", "2002-04-02")
      .field("id_number", "1103700123451")
      .attach("imageFile", Buffer.from("fake-image"), {
        filename: "avatar.jpg",
        contentType: "image/jpeg",
      });

    assert.equal(res.status, 200);
    assert.equal(uploadImageFile.mock.callCount(), 1);
    const [, pending] = savePending.mock.calls[0].arguments;
    assert.equal(pending.avatar_url, "https://cdn.example.com/avatar/mock.jpg");
  });

  it("Exception Path: missing Authorization", async () => {
    const app = createTestApp();
    const res = await putBasic(app, validBasicFields(), null);
    assert.equal(res.status, 401);
    assert.equal(res.body.message, "Unauthorized");
  });

  it("Exception Path: user is not a sitter", async () => {
    const app = createTestApp({ isSitter: false });
    const res = await putBasic(app);
    assert.equal(res.status, 403);
    assert.equal(res.body.message, "Forbidden: You are not a sitter");
  });

  it("Error Case: invalid full name returns 400", async () => {
    const app = createTestApp();
    const res = await putBasic(app, { ...validBasicFields(), name: "Kai" });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Full name must be 6-20 characters");
    assert.equal(savePending.mock.callCount(), 0);
  });

  it("Boundary Case: age exactly 18 succeeds", async () => {
    const app = createTestApp();
    const res = await putBasic(app, {
      ...validBasicFields(),
      date_of_birth: yearsAgo(18),
    });
    assert.equal(res.status, 200);
  });

  it("Error Case: age under 18 returns 400", async () => {
    const app = createTestApp();
    const res = await putBasic(app, {
      ...validBasicFields(),
      date_of_birth: yearsAgo(17),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Pet sitter must be at least 18 years old");
  });

  it("Error Case: phone already in use", async () => {
    isPhoneTaken.mock.mockImplementation(async () => true);
    const app = createTestApp();
    const res = await putBasic(app);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Phone number is already in use");
  });

  it("Error Case: email already in use", async () => {
    isEmailTaken.mock.mockImplementation(async () => true);
    const app = createTestApp();
    const res = await putBasic(app);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Email is already in use");
  });

  it("Error Case: pet type required when unlocked", async () => {
    findByUserId.mock.mockImplementation(async () => unlockedProfile());
    const app = createTestApp();
    const res = await putBasic(app, {
      ...validBasicFields(),
      display_name: "Kai Cenat",
      address_detail: "123 Road",
      district: "Watthana",
      sub_district: "Khlong Toei Nuea",
      province: "Bangkok",
      post_code: "10110",
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Pet type is required");
  });

  it("Error Case: invalid image type", async () => {
    const app = createTestApp();
    const res = await request(app)
      .put("/api/sitters/me")
      .set("Authorization", "Bearer sitter-token")
      .field("name", "Kai Cenat")
      .field("experience_years", "5+")
      .field("phone", "0814568779")
      .field("email", "sitter8@test.com")
      .field("date_of_birth", "2002-04-02")
      .field("id_number", "1103700123451")
      .attach("imageFile", Buffer.from("GIF89a"), {
        filename: "avatar.gif",
        contentType: "image/gif",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Image must be .jpg, .jpeg, or .png");
  });

  it("Error Case: image larger than 2MB", async () => {
    const app = createTestApp();
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 1);
    const res = await request(app)
      .put("/api/sitters/me")
      .set("Authorization", "Bearer sitter-token")
      .field("name", "Kai Cenat")
      .field("experience_years", "5+")
      .field("phone", "0814568779")
      .field("email", "sitter8@test.com")
      .field("date_of_birth", "2002-04-02")
      .field("id_number", "1103700123451")
      .attach("imageFile", big, {
        filename: "avatar.jpg",
        contentType: "image/jpeg",
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Image must be 2MB or smaller");
  });

  it("Boundary Case: gallery with exactly 10 images succeeds", async () => {
    findByUserId.mock.mockImplementation(async () => unlockedProfile());
    const existing = Array.from({ length: 9 }, (_, index) => ({
      id: index + 1,
      photo_url: `https://cdn.example.com/p${index + 1}.jpg`,
    }));

    const app = createTestApp();
    const res = await request(app)
      .put("/api/sitters/me")
      .set("Authorization", "Bearer sitter-token")
      .field("name", "Kai Cenat")
      .field("experience_years", "5+")
      .field("phone", "0814568779")
      .field("email", "sitter8@test.com")
      .field("date_of_birth", "2002-04-02")
      .field("id_number", "1103700123451")
      .field("display_name", "Kai Cenat")
      .field("pet_types", "Dog")
      .field("address_detail", "123 Road")
      .field("district", "Watthana")
      .field("sub_district", "Khlong Toei Nuea")
      .field("province", "Bangkok")
      .field("post_code", "10110")
      .field("existing_gallery", JSON.stringify(existing))
      .attach("galleryFiles", Buffer.from("img"), {
        filename: "new.jpg",
        contentType: "image/jpeg",
      });

    assert.equal(res.status, 200);
    const [, pending] = savePending.mock.calls[0].arguments;
    assert.equal(pending.photos.length, 10);
  });

  it("Error Case: gallery over 10 images", async () => {
    findByUserId.mock.mockImplementation(async () => unlockedProfile());
    const existing = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      photo_url: `https://cdn.example.com/p${index + 1}.jpg`,
    }));

    const app = createTestApp();
    const res = await request(app)
      .put("/api/sitters/me")
      .set("Authorization", "Bearer sitter-token")
      .field("name", "Kai Cenat")
      .field("experience_years", "5+")
      .field("phone", "0814568779")
      .field("email", "sitter8@test.com")
      .field("date_of_birth", "2002-04-02")
      .field("id_number", "1103700123451")
      .field("display_name", "Kai Cenat")
      .field("pet_types", "Dog")
      .field("address_detail", "123 Road")
      .field("district", "Watthana")
      .field("sub_district", "Khlong Toei Nuea")
      .field("province", "Bangkok")
      .field("post_code", "10110")
      .field("existing_gallery", JSON.stringify(existing))
      .attach("galleryFiles", Buffer.from("img"), {
        filename: "new.jpg",
        contentType: "image/jpeg",
      });

    assert.equal(res.status, 400);
    assert.equal(
      res.body.message,
      "Image gallery allows a maximum of 10 images"
    );
  });
});
