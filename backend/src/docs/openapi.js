const objectIdSchema = {
  type: "string",
  pattern: "^[a-fA-F0-9]{24}$",
  example: "66cf2345a91d514ea05d9981",
};

const isoDateSchema = {
  type: "string",
  format: "date-time",
  example: "2026-03-14T10:30:00.000Z",
};

const amountSchema = {
  type: "number",
  example: 125000,
};

const successEnvelope = (dataSchema) => ({
  type: "object",
  required: ["success", "data", "error"],
  properties: {
    success: { type: "boolean", enum: [true], example: true },
    data: dataSchema,
    error: { type: "object", nullable: true, example: null },
  },
});

const json = (schema) => ({
  "application/json": {
    schema,
  },
});

const errorRef = { $ref: "#/components/responses/ErrorResponse" };
const unauthorizedRef = { $ref: "#/components/responses/UnauthorizedError" };
const bearerSecurity = [{ bearerAuth: [] }];

const buildOpenApiSpec = ({ serverUrl }) => ({
  openapi: "3.0.3",
  info: {
    title: "D2P Agri Platform Backend API",
    version: "0.1.0",
    description:
      "Swagger documentation for the Express backend powering auth, farmer, buyer, admin, disease scanning, and payment flows.",
  },
  servers: [{ url: serverUrl, description: "Current backend server" }],
  tags: [
    { name: "Auth", description: "Authentication and session lifecycle" },
    { name: "Buyer", description: "Buyer marketplace, orders, and escrow flows" },
    { name: "Farmer", description: "Farmer dashboard, inventory, and batches" },
    { name: "Disease", description: "Crop disease analysis and LLM recommendations" },
    { name: "Admin", description: "Admin oversight, dispute, and payout tooling" },
    { name: "Payments", description: "Inbound payment webhooks" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token returned by POST /auth/login.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["success", "data", "error"],
        properties: {
          success: { type: "boolean", enum: [false], example: false },
          data: { type: "object", nullable: true, example: null },
          error: {
            type: "object",
            required: ["code", "message", "details"],
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Invalid input" },
              details: { type: "object", nullable: true, additionalProperties: true },
            },
          },
        },
      },
      AuthUser: {
        type: "object",
        properties: {
          id: objectIdSchema,
          fullName: { type: "string", example: "Aline Mukamana" },
          phoneNumber: { type: "string", nullable: true, example: "+250788000000" },
          role: { type: "string", enum: ["FARMER", "BUYER", "ADMIN"], example: "BUYER" },
          createdAt: { ...isoDateSchema, nullable: true },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["fullName", "password", "role"],
        properties: {
          fullName: { type: "string", example: "Aline Mukamana" },
          phoneNumber: { type: "string", example: "+250788000000" },
          email: { type: "string", format: "email", example: "aline@example.com" },
          password: { type: "string", format: "password", example: "secret123" },
          role: { type: "string", enum: ["FARMER", "BUYER", "ADMIN"], example: "BUYER" },
          adminInviteCode: { type: "string", example: "ADM-2026" },
        },
        description: "Provide either phoneNumber or email.",
      },
      LoginRequest: {
        type: "object",
        required: ["identifier", "password"],
        properties: {
          identifier: { type: "string", example: "aline@example.com" },
          password: { type: "string", format: "password", example: "secret123" },
        },
      },
      RefreshRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token",
          },
        },
      },
      MarketPrice: {
        type: "object",
        properties: {
          id: objectIdSchema,
          crop: { type: "string", example: "Maize" },
          cropKey: { type: "string", example: "maize" },
          price: { type: "string", example: "650" },
          unit: { type: "string", example: "/kg" },
          currency: { type: "string", example: "RWF" },
          region: { type: "string", example: "Rwanda" },
          source: { type: "string", example: "database" },
          asOf: isoDateSchema,
          change: { type: "string", example: "-0.8%" },
          positive: { type: "boolean", example: false },
          numericPrice: { type: "number", example: 650 },
          numericChangePercent: { type: "number", example: -0.76 },
        },
      },
      BuyerOrderSummary: {
        type: "object",
        properties: {
          id: objectIdSchema,
          orderNumber: { type: "string", example: "AG-123456" },
          title: { type: "string", example: "Dry Beans Batch" },
          cropKey: { type: "string", example: "beans" },
          cropNames: { type: "array", items: { type: "string" }, example: ["Dry Beans"] },
          farmerName: { type: "string", example: "Jean Ndayisaba" },
          destination: { type: "string", example: "Kigali Central Aggregator" },
          status: { type: "string", example: "active" },
          paymentStatus: { type: "string", example: "deposit_paid" },
          trackingStage: { type: "string", example: "hub_inspection" },
          image: { type: "string", nullable: true, example: "/uploads/1710400012345.jpg" },
          totalWeight: { type: "number", example: 1200 },
          totalPrice: amountSchema,
          pricePerKg: { type: "number", example: 850 },
          currency: { type: "string", example: "RWF" },
          depositPercent: { type: "number", example: 0.6 },
          depositAmount: amountSchema,
          balanceDue: amountSchema,
          serviceFee: amountSchema,
          insuranceFee: amountSchema,
          amountDueToday: amountSchema,
          paymentMethod: { type: "string", example: "card" },
          escrowStatus: { type: "string", example: "funded" },
          stripeCheckoutSessionId: { type: "string", nullable: true, example: "cs_test_a1b2c3" },
          stripePaymentIntentId: { type: "string", nullable: true, example: "pi_123456789" },
          stripeTransferId: { type: "string", nullable: true, example: null },
          stripePaymentStatus: { type: "string", nullable: true, example: "paid" },
          estimatedArrivalAt: { ...isoDateSchema, nullable: true },
          trackingUpdatedAt: { ...isoDateSchema, nullable: true },
          paymentConfirmedAt: { ...isoDateSchema, nullable: true },
          escrowFundedAt: { ...isoDateSchema, nullable: true },
          escrowReleasedAt: { ...isoDateSchema, nullable: true },
          deliveryConfirmedAt: { ...isoDateSchema, nullable: true },
          createdAt: { ...isoDateSchema, nullable: true },
          updatedAt: { ...isoDateSchema, nullable: true },
        },
      },
      TimelineEntry: {
        type: "object",
        properties: {
          key: { type: "string", example: "payment_confirmed" },
          title: { type: "string", example: "Payment Confirmed" },
          detail: { type: "string", example: "Deposit secured in escrow via CARD" },
          time: { type: "string", example: "3/14/2026, 10:45:00 AM" },
          status: { type: "string", enum: ["done", "active", "pending"], example: "active" },
          updatedAt: isoDateSchema,
        },
      },
      FarmerProduct: {
        type: "object",
        properties: {
          _id: objectIdSchema,
          farmer: objectIdSchema,
          name: { type: "string", example: "Maize" },
          quantity: { type: "number", example: 500 },
          unit: { type: "string", example: "kg" },
          pricePerUnit: { type: "number", example: 650 },
          image: { type: "string", nullable: true, example: "/uploads/1710400012345.jpg" },
          createdAt: { ...isoDateSchema, nullable: true },
          updatedAt: { ...isoDateSchema, nullable: true },
        },
        additionalProperties: true,
      },
      FarmerBatch: {
        type: "object",
        properties: {
          _id: objectIdSchema,
          farmer: objectIdSchema,
          products: { type: "array", items: { type: "object", additionalProperties: true } },
          totalWeight: { type: "number", example: 500 },
          totalPrice: amountSchema,
          destination: { type: "string", example: "Kigali Central Aggregator" },
          status: { type: "string", example: "active" },
          createdAt: { ...isoDateSchema, nullable: true },
          updatedAt: { ...isoDateSchema, nullable: true },
        },
        additionalProperties: true,
      },
      ScanQualityResult: {
        type: "object",
        properties: {
          moisture: { type: "string", example: "13.2%" },
          grade: { type: "string", example: "Grade A" },
          pests: { type: "string", example: "healthy" },
          disease_confidence: { type: "number", example: 0.91 },
          recommendation: { type: "string" },
          ml_data: { type: "object", additionalProperties: true },
          is_fallback: { type: "boolean", example: false },
        },
      },
      DiseasePrediction: {
        type: "object",
        properties: {
          imageId: { type: "string", format: "uuid" },
          cropType: { type: "string", example: "maize" },
          disease: { type: "string", example: "common_rust" },
          candidateDisease: { type: "string", example: "common_rust" },
          confidence: { type: "number", minimum: 0, maximum: 1, example: 0.82 },
          isUncertain: { type: "boolean", example: false },
          uncertaintyReasons: { type: "array", items: { type: "string" } },
          thresholdApplied: { type: "number", example: 0.65 },
          margin: { type: "number", example: 0.17 },
          marginThreshold: { type: "number", example: 0.05 },
          topPredictions: { type: "array", items: { type: "object", additionalProperties: true } },
          modelVersion: { type: "string", example: "mock-v1" },
          latencyMs: { type: "number", example: 184 },
          summary: { type: "string" },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
      DiseaseGeneration: {
        type: "object",
        properties: {
          imageId: { type: "string", format: "uuid" },
          cropType: { type: "string", example: "bean" },
          disease: { type: "string", example: "bean_rust" },
          candidateDisease: { type: "string", example: "bean_rust" },
          diagnosis: { type: "string", example: "Likely bean rust infection on lower leaves." },
          recommendation: { type: "string" },
          generatedText: { type: "string" },
          source: { type: "string", nullable: true, example: "paligemma" },
          confidence: { type: "number", minimum: 0, maximum: 1, example: 0.78 },
          isUncertain: { type: "boolean", example: false },
          uncertaintyReasons: { type: "array", items: { type: "string" } },
          modelVersion: { type: "string", example: "paligemma-rwanda-lora" },
          latencyMs: { type: "number", example: 923 },
          summary: { type: "string" },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
      DiseaseRecommendationRequest: {
        type: "object",
        required: ["cropType", "disease", "confidence"],
        properties: {
          cropType: { type: "string", enum: ["maize", "bean", "beans"], example: "maize" },
          disease: { type: "string", example: "common_rust" },
          confidence: { type: "number", minimum: 0, maximum: 1, example: 0.82 },
          location: { type: "string", example: "Rwamagana, Rwanda" },
          locationContext: { type: "object", additionalProperties: true },
          season: { type: "string", example: "Season B" },
          farmerGoal: { type: "string", example: "protect yield" },
          severity: { type: "string", enum: ["mild", "moderate", "severe"], example: "moderate" },
          language: { type: "string", enum: ["en", "rw"], example: "en" },
        },
      },
      DiseaseRecommendationResult: {
        type: "object",
        properties: {
          recommendationsMarkdown: { type: "string" },
          citations: { type: "array", items: { type: "string", format: "uri" } },
          safetyNotes: { type: "string", nullable: true },
        },
      },
      AdminDispute: {
        type: "object",
        properties: {
          id: objectIdSchema,
          orderId: { type: "string", example: "66cf2345a91d514ea05d9981" },
          orderNumber: { type: "string", example: "#7729" },
          hubId: { type: "string", example: "HU-EAST-18" },
          hubName: { type: "string", example: "Kayonza Hub" },
          region: { type: "string", example: "Eastern Province" },
          commodity: { type: "string", example: "Maize" },
          issue: { type: "string", example: "Moisture content mismatch (+4%)" },
          anomalyType: { type: "string", example: "quality_variance" },
          severity: { type: "string", enum: ["high", "medium", "low"], example: "high" },
          severityLabel: { type: "string", example: "Pending Escalation" },
          reviewState: { type: "string", example: "pending escalation" },
          confidenceScore: { type: "number", example: 94.2 },
          aiDetectedGrade: { type: "string", example: "A" },
          issueDeltaPercent: { type: "number", example: 4 },
          operatorComments: { type: "string" },
          adminComments: { type: "string" },
          updatedAt: isoDateSchema,
        },
      },
      RawWebhookEvent: {
        type: "object",
        additionalProperties: true,
      },
    },
    responses: {
      ErrorResponse: {
        description: "Error response",
        content: json({ $ref: "#/components/schemas/ErrorResponse" }),
      },
      UnauthorizedError: {
        description: "Missing or invalid access token",
        content: json({
          allOf: [{ $ref: "#/components/schemas/ErrorResponse" }],
          example: {
            success: false,
            data: null,
            error: {
              code: "UNAUTHORIZED",
              message: "Missing access token",
              details: null,
            },
          },
        }),
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        operationId: "registerUser",
        requestBody: {
          required: true,
          content: json({ $ref: "#/components/schemas/RegisterRequest" }),
        },
        responses: {
          "201": {
            description: "User registered",
            content: json(successEnvelope({
              type: "object",
              properties: { user: { $ref: "#/components/schemas/AuthUser" } },
            })),
          },
          "400": errorRef,
          "403": errorRef,
          "409": errorRef,
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Authenticate a user",
        operationId: "loginUser",
        requestBody: {
          required: true,
          content: json({ $ref: "#/components/schemas/LoginRequest" }),
        },
        responses: {
          "200": {
            description: "User authenticated",
            content: json(successEnvelope({
              type: "object",
              properties: {
                accessToken: { type: "string" },
                refreshToken: { type: "string" },
                user: { $ref: "#/components/schemas/AuthUser" },
              },
            })),
          },
          "400": errorRef,
          "401": errorRef,
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh an access token",
        operationId: "refreshAccessToken",
        requestBody: {
          required: true,
          content: json({ $ref: "#/components/schemas/RefreshRequest" }),
        },
        responses: {
          "200": {
            description: "Access token refreshed",
            content: json(successEnvelope({
              type: "object",
              properties: { accessToken: { type: "string" } },
            })),
          },
          "400": errorRef,
          "401": errorRef,
          "404": errorRef,
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the authenticated user",
        operationId: "getCurrentUser",
        security: bearerSecurity,
        responses: {
          "200": {
            description: "Authenticated user",
            content: json(successEnvelope({
              type: "object",
              properties: { user: { $ref: "#/components/schemas/AuthUser" } },
            })),
          },
          "401": unauthorizedRef,
          "403": errorRef,
          "404": errorRef,
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Invalidate a refresh token",
        operationId: "logoutUser",
        requestBody: {
          required: true,
          content: json({ $ref: "#/components/schemas/RefreshRequest" }),
        },
        responses: {
          "200": {
            description: "User logged out",
            content: json(successEnvelope({
              type: "object",
              properties: { message: { type: "string", example: "Logged out" } },
            })),
          },
          "400": errorRef,
        },
      },
    },
    "/buyer/marketplace": {
      get: {
        tags: ["Buyer"],
        summary: "List marketplace batches available to buyers",
        operationId: "getBuyerMarketplace",
        security: bearerSecurity,
        parameters: [
          { in: "query", name: "q", schema: { type: "string" } },
          { in: "query", name: "crop", schema: { type: "string", example: "beans" } },
        ],
        responses: {
          "200": {
            description: "Marketplace payload",
            content: json(successEnvelope({
              type: "object",
              properties: {
                total: { type: "integer" },
                allCount: { type: "integer" },
                filters: { type: "object", additionalProperties: true },
                categories: { type: "array", items: { type: "object", additionalProperties: true } },
                batches: { type: "array", items: { type: "object", additionalProperties: true } },
                lastSynced: isoDateSchema,
              },
            })),
          },
          "401": unauthorizedRef,
        },
      },
    },
    "/buyer/profile": {
      get: {
        tags: ["Buyer"],
        summary: "Get buyer profile and recent orders",
        operationId: "getBuyerProfile",
        security: bearerSecurity,
        responses: {
          "200": {
            description: "Buyer profile payload",
            content: json(successEnvelope({
              type: "object",
              properties: {
                buyer: { type: "object", additionalProperties: true },
                summary: { type: "object", additionalProperties: true },
                recentOrders: { type: "array", items: { $ref: "#/components/schemas/BuyerOrderSummary" } },
                lastSynced: isoDateSchema,
              },
            })),
          },
          "401": unauthorizedRef,
          "404": errorRef,
        },
      },
    },
    "/buyer/orders": {
      get: {
        tags: ["Buyer"],
        summary: "List buyer orders",
        operationId: "getBuyerOrders",
        security: bearerSecurity,
        parameters: [
          {
            in: "query",
            name: "status",
            schema: {
              type: "string",
              enum: ["all", "active", "in_progress", "completed", "cancelled"],
              default: "all",
            },
          },
        ],
        responses: {
          "200": {
            description: "Order history payload",
            content: json(successEnvelope({
              type: "object",
              properties: {
                totals: { type: "object", additionalProperties: true },
                filters: { type: "object", additionalProperties: true },
                orders: { type: "array", items: { $ref: "#/components/schemas/BuyerOrderSummary" } },
                lastSynced: isoDateSchema,
              },
            })),
          },
          "401": unauthorizedRef,
        },
      },
      post: {
        tags: ["Buyer"],
        summary: "Create a buyer order from an active batch",
        operationId: "createBuyerOrder",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["batchId"],
            properties: {
              batchId: objectIdSchema,
              paymentMethod: { type: "string", enum: ["card", "momo", "airtel", "bank"], example: "card" },
            },
          }),
        },
        responses: {
          "201": {
            description: "Order created",
            content: json(successEnvelope({
              type: "object",
              properties: {
                order: { $ref: "#/components/schemas/BuyerOrderSummary" },
                timeline: { type: "array", items: { $ref: "#/components/schemas/TimelineEntry" } },
              },
            })),
          },
          "400": errorRef,
          "401": unauthorizedRef,
          "404": errorRef,
        },
      },
    },
    "/buyer/orders/{id}": {
      get: {
        tags: ["Buyer"],
        summary: "Get one buyer order with its timeline",
        operationId: "getBuyerOrderById",
        security: bearerSecurity,
        parameters: [{ in: "path", name: "id", required: true, schema: objectIdSchema }],
        responses: {
          "200": {
            description: "Order detail payload",
            content: json(successEnvelope({
              type: "object",
              properties: {
                order: { $ref: "#/components/schemas/BuyerOrderSummary" },
                timeline: { type: "array", items: { $ref: "#/components/schemas/TimelineEntry" } },
              },
            })),
          },
          "401": unauthorizedRef,
          "404": errorRef,
        },
      },
    },
    "/buyer/orders/{id}/checkout-session": {
      post: {
        tags: ["Buyer"],
        summary: "Create or simulate a checkout session for an order deposit",
        operationId: "createBuyerCheckoutSession",
        security: bearerSecurity,
        parameters: [{ in: "path", name: "id", required: true, schema: objectIdSchema }],
        responses: {
          "200": {
            description: "Checkout session created",
            content: json(successEnvelope({
              type: "object",
              properties: {
                order: { $ref: "#/components/schemas/BuyerOrderSummary" },
                timeline: { type: "array", items: { $ref: "#/components/schemas/TimelineEntry" } },
                checkout: { type: "object", additionalProperties: true },
              },
            })),
          },
          "400": errorRef,
          "401": unauthorizedRef,
          "404": errorRef,
          "501": errorRef,
          "503": errorRef,
        },
      },
    },
    "/buyer/orders/{id}/release-escrow": {
      post: {
        tags: ["Buyer"],
        summary: "Release funded escrow to the farmer",
        operationId: "releaseBuyerEscrow",
        security: bearerSecurity,
        parameters: [{ in: "path", name: "id", required: true, schema: objectIdSchema }],
        responses: {
          "200": {
            description: "Escrow released or already released",
            content: json(successEnvelope({
              type: "object",
              properties: {
                order: { $ref: "#/components/schemas/BuyerOrderSummary" },
                timeline: { type: "array", items: { $ref: "#/components/schemas/TimelineEntry" } },
              },
            })),
          },
          "400": errorRef,
          "401": unauthorizedRef,
          "404": errorRef,
          "503": errorRef,
        },
      },
    },
    "/farmer/dashboard": {
      get: {
        tags: ["Farmer"],
        summary: "Get farmer dashboard data",
        operationId: "getFarmerDashboard",
        security: bearerSecurity,
        responses: {
          "200": {
            description: "Dashboard payload",
            content: json(successEnvelope({
              type: "object",
              properties: {
                totalEarnings: amountSchema,
                earningsChange: { type: "string", example: "+0% vs last month" },
                activeBatches: { type: "array", items: { $ref: "#/components/schemas/FarmerBatch" } },
                marketPrices: { type: "array", items: { $ref: "#/components/schemas/MarketPrice" } },
                lastSynced: isoDateSchema,
              },
            })),
          },
          "401": unauthorizedRef,
        },
      },
    },
    "/farmer/market": {
      get: {
        tags: ["Farmer"],
        summary: "Get market prices for the farmer dashboard",
        operationId: "getFarmerMarket",
        security: bearerSecurity,
        responses: {
          "200": {
            description: "Market price payload",
            content: json(successEnvelope({
              type: "object",
              properties: {
                marketPrices: { type: "array", items: { $ref: "#/components/schemas/MarketPrice" } },
                lastSynced: isoDateSchema,
                source: { type: "string", example: "database" },
                seededDefaults: { type: "boolean", example: false },
              },
            })),
          },
          "401": unauthorizedRef,
        },
      },
    },
    "/farmer/wallet": {
      get: {
        tags: ["Farmer"],
        summary: "Get farmer wallet summary and recent activity",
        operationId: "getFarmerWallet",
        security: bearerSecurity,
        responses: {
          "200": {
            description: "Wallet payload",
            content: json(successEnvelope({
              type: "object",
              properties: {
                currency: { type: "string", example: "RWF" },
                availableBalance: amountSchema,
                totalEarned: amountSchema,
                pendingPayout: amountSchema,
                recentActivity: { type: "array", items: { type: "object", additionalProperties: true } },
                lastSynced: isoDateSchema,
              },
            })),
          },
          "401": unauthorizedRef,
        },
      },
    },
    "/farmer/inventory": {
      get: {
        tags: ["Farmer"],
        summary: "List farmer inventory products",
        operationId: "getFarmerInventory",
        security: bearerSecurity,
        responses: {
          "200": {
            description: "Inventory list",
            content: json(successEnvelope({
              type: "array",
              items: { $ref: "#/components/schemas/FarmerProduct" },
            })),
          },
          "401": unauthorizedRef,
        },
      },
      post: {
        tags: ["Farmer"],
        summary: "Create a farmer inventory product",
        operationId: "createFarmerProduct",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["name", "quantity", "unit", "pricePerUnit"],
                properties: {
                  name: { type: "string", example: "Maize" },
                  quantity: { type: "number", example: 500 },
                  unit: { type: "string", example: "kg" },
                  pricePerUnit: { type: "number", example: 650 },
                  image: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Product created",
            content: json(successEnvelope({ $ref: "#/components/schemas/FarmerProduct" })),
          },
          "401": unauthorizedRef,
        },
      },
    },
    "/farmer/batch": {
      post: {
        tags: ["Farmer"],
        summary: "Create a farmer batch",
        operationId: "createFarmerBatch",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["products", "totalWeight", "totalPrice", "destination"],
            properties: {
              products: { type: "array", items: { type: "object", additionalProperties: true } },
              totalWeight: { type: "number", example: 500 },
              totalPrice: amountSchema,
              destination: { type: "string", example: "Kigali Central Aggregator" },
            },
          }),
        },
        responses: {
          "201": {
            description: "Batch created",
            content: json(successEnvelope({ $ref: "#/components/schemas/FarmerBatch" })),
          },
          "401": unauthorizedRef,
        },
      },
    },
    "/farmer/batch/{id}": {
      get: {
        tags: ["Farmer"],
        summary: "Get one batch belonging to the farmer",
        operationId: "getFarmerBatchById",
        security: bearerSecurity,
        parameters: [{ in: "path", name: "id", required: true, schema: objectIdSchema }],
        responses: {
          "200": {
            description: "Batch detail",
            content: json(successEnvelope({ $ref: "#/components/schemas/FarmerBatch" })),
          },
          "401": unauthorizedRef,
          "403": errorRef,
          "404": errorRef,
        },
      },
    },
    "/farmer/scan-quality": {
      post: {
        tags: ["Farmer"],
        summary: "Run the farmer quality scan flow on one image",
        operationId: "scanFarmerQuality",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: { type: "string", format: "binary" },
                  cropHint: { type: "string", example: "maize" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Quality scan result",
            content: json(successEnvelope({ $ref: "#/components/schemas/ScanQualityResult" })),
          },
          "400": errorRef,
          "401": unauthorizedRef,
        },
      },
    },
    "/api/disease/analyze": {
      post: {
        tags: ["Disease"],
        summary: "Analyze uploaded crop images with the disease classifier flow",
        operationId: "analyzeDiseaseImages",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["images"],
                properties: {
                  images: { type: "array", items: { type: "string", format: "binary" } },
                  cropHint: { type: "string", enum: ["maize", "beans", "auto"], default: "auto" },
                  mode: { type: "string", enum: ["camera", "upload", "live"], default: "upload" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Prediction results for each uploaded image",
            content: json({ type: "array", items: { $ref: "#/components/schemas/DiseasePrediction" } }),
          },
          "400": errorRef,
          "429": errorRef,
          "502": errorRef,
          "503": errorRef,
          "504": errorRef,
        },
      },
    },
    "/api/disease/generate": {
      post: {
        tags: ["Disease"],
        summary: "Analyze crop images with the generative PaLiGemma flow",
        operationId: "generateDiseaseAnalysis",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["images"],
                properties: {
                  images: { type: "array", items: { type: "string", format: "binary" } },
                  cropHint: { type: "string", enum: ["maize", "beans", "auto"], default: "auto" },
                  mode: { type: "string", enum: ["camera", "upload", "live"], default: "upload" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Generative disease analysis per image",
            content: json({ type: "array", items: { $ref: "#/components/schemas/DiseaseGeneration" } }),
          },
          "400": errorRef,
          "429": errorRef,
          "502": errorRef,
          "503": errorRef,
          "504": errorRef,
        },
      },
    },
    "/api/disease/recommendations": {
      post: {
        tags: ["Disease"],
        summary: "Get LLM-generated crop disease recommendations",
        operationId: "getDiseaseRecommendations",
        requestBody: {
          required: true,
          content: json({ $ref: "#/components/schemas/DiseaseRecommendationRequest" }),
        },
        responses: {
          "200": {
            description: "Structured markdown recommendations",
            content: json({ $ref: "#/components/schemas/DiseaseRecommendationResult" }),
          },
          "400": errorRef,
          "429": errorRef,
          "502": errorRef,
          "503": errorRef,
          "504": errorRef,
        },
      },
    },
    "/admin/overview": {
      get: {
        tags: ["Admin"],
        summary: "Get admin overview dashboard data",
        operationId: "getAdminOverview",
        security: bearerSecurity,
        parameters: [{ in: "query", name: "window", schema: { type: "string", enum: ["live", "24h", "weekly", "monthly"], default: "live" } }],
        responses: {
          "200": {
            description: "Admin overview payload",
            content: json(successEnvelope({ type: "object", additionalProperties: true })),
          },
          "401": unauthorizedRef,
          "403": errorRef,
        },
      },
    },
    "/admin/escrow-audit": {
      get: {
        tags: ["Admin"],
        summary: "Get the escrow audit screen data",
        operationId: "getAdminEscrowAudit",
        security: bearerSecurity,
        parameters: [
          { in: "query", name: "q", schema: { type: "string" } },
          { in: "query", name: "region", schema: { type: "string" } },
          { in: "query", name: "hub", schema: { type: "string" } },
          { in: "query", name: "status", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Escrow audit payload",
            content: json(successEnvelope({ type: "object", additionalProperties: true })),
          },
          "401": unauthorizedRef,
          "403": errorRef,
        },
      },
    },
    "/admin/escrow-audit/release-batch-payouts": {
      post: {
        tags: ["Admin"],
        summary: "Release funded escrow payouts in batch",
        operationId: "releaseAdminBatchPayouts",
        security: bearerSecurity,
        requestBody: {
          required: false,
          content: json({ type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 10 } } }),
        },
        responses: {
          "200": {
            description: "Batch payout execution summary",
            content: json(successEnvelope({ type: "object", additionalProperties: true })),
          },
          "401": unauthorizedRef,
          "403": errorRef,
        },
      },
    },
    "/admin/hubs-disputes": {
      get: {
        tags: ["Admin"],
        summary: "Get hub statistics and unresolved disputes",
        operationId: "getAdminHubDisputes",
        security: bearerSecurity,
        parameters: [
          { in: "query", name: "q", schema: { type: "string" } },
          { in: "query", name: "tab", schema: { type: "string", enum: ["hub_stats", "quality_disputes"] } },
          { in: "query", name: "severity", schema: { type: "string", enum: ["all", "high", "medium", "low"] } },
        ],
        responses: {
          "200": {
            description: "Hub disputes payload",
            content: json(successEnvelope({
              type: "object",
              properties: {
                disputes: { type: "array", items: { $ref: "#/components/schemas/AdminDispute" } },
              },
              additionalProperties: true,
            })),
          },
          "401": unauthorizedRef,
          "403": errorRef,
        },
      },
    },
    "/admin/disputes": {
      post: {
        tags: ["Admin"],
        summary: "Create an admin dispute manually",
        operationId: "createAdminDispute",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["issue"],
            properties: {
              orderId: objectIdSchema,
              batchId: objectIdSchema,
              hubId: { type: "string" },
              hubName: { type: "string" },
              region: { type: "string" },
              commodity: { type: "string" },
              issue: { type: "string" },
              anomalyType: { type: "string" },
              severity: { type: "string", enum: ["high", "medium", "low"] },
              confidenceScore: { type: "number" },
              aiDetectedGrade: { type: "string" },
              issueDeltaPercent: { type: "number" },
              operatorComments: { type: "string" },
              adminComments: { type: "string" },
            },
          }),
        },
        responses: {
          "201": {
            description: "Dispute created",
            content: json(successEnvelope({
              type: "object",
              properties: { dispute: { $ref: "#/components/schemas/AdminDispute" } },
            })),
          },
          "400": errorRef,
          "401": unauthorizedRef,
          "403": errorRef,
          "409": errorRef,
        },
      },
    },
    "/admin/disputes/{id}/review": {
      patch: {
        tags: ["Admin"],
        summary: "Review, resolve, dismiss, or comment on a dispute",
        operationId: "reviewAdminDispute",
        security: bearerSecurity,
        parameters: [{ in: "path", name: "id", required: true, schema: objectIdSchema }],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            properties: {
              action: { type: "string", enum: ["start_review", "escalate", "resolve", "dismiss", "reopen", "comment"] },
              comment: { type: "string" },
            },
          }),
        },
        responses: {
          "200": {
            description: "Updated dispute",
            content: json(successEnvelope({
              type: "object",
              properties: { dispute: { $ref: "#/components/schemas/AdminDispute" } },
            })),
          },
          "400": errorRef,
          "401": unauthorizedRef,
          "403": errorRef,
          "404": errorRef,
        },
      },
    },
    "/payments/stripe/webhook": {
      post: {
        tags: ["Payments"],
        summary: "Receive Stripe webhook events",
        operationId: "handleStripeWebhook",
        description:
          "This endpoint expects the raw Stripe request body. When STRIPE_WEBHOOK_SECRET is configured, the stripe-signature header is verified.",
        parameters: [{ in: "header", name: "stripe-signature", schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: json({ $ref: "#/components/schemas/RawWebhookEvent" }),
        },
        responses: {
          "200": {
            description: "Webhook accepted",
            content: json({ type: "object", properties: { received: { type: "boolean", example: true } } }),
          },
          "400": { description: "Invalid webhook signature or payload", content: json({ type: "object", additionalProperties: true }) },
          "500": { description: "Webhook processing failed", content: json({ type: "object", additionalProperties: true }) },
          "503": { description: "Stripe is not configured", content: json({ type: "object", additionalProperties: true }) },
        },
      },
    },
  },
});

module.exports = {
  buildOpenApiSpec,
};
