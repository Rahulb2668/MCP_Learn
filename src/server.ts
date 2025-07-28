import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import fs from "fs/promises";
import { read } from "fs";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
type User = {
  id: number;
  name: string;
  email: string;
  address: string;
  phone: string;
};
const server = new McpServer({
  name: "test-server",
  version: "1.0.0",
});

// Regisering Tool for creating a user

server.registerTool(
  "create-user",
  {
    title: "Create User",
    description: "Creates a new user in the system",
    inputSchema: {
      name: z.string(),
      email: z.string(),
      address: z.string(),
      phone: z.string(),
    },
  },
  async (params) => {
    try {
      const id = await createUser(params);

      return {
        content: [{ type: "text", text: `User created with ID: ${id}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error creating user` }],
      };
    }
  }
);

server.registerTool(
  "create-random-user",
  {
    title: "Create Random User",
    description: "Generates a random user with realistic details",
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  async () => {
    const response = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Generate fake user data. The user should have a realistic name, email, address, and phone number. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse.",
          },
        },
      ],
      maxTokens: 1000,
    });

    if (!response.content.text) {
      return {
        content: [{ type: "text", text: `Failed to generate user` }],
      };
    }

    try {
      const randomUser = JSON.parse(
        String(response.content.text)
          .trim()
          .replace(/^```json/, "")
          .replace(/```$/, "")
          .trim()
      );

      console.log("Random User Data:", randomUser, response);
      const id = await createUser(randomUser);
      return {
        content: [
          {
            type: "text",
            text: `Random user created with ID: ${id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: "Failed to generate user data" }],
      };
    }
  }
);

//Register a resource

server.registerResource(
  "users",
  "users://all",
  {
    title: "Get all users",
    description: "Retrieves all users from the system",
    inputSchema: {},
    outputSchema: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
        address: z.string(),
        phone: z.string(),
      })
    ),
  },
  async (uri) => {
    try {
      const users = await getAllUsers();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(users),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error retrieving users`,
            mimeType: "text/plain",
          },
        ],
      };
    }
  }
);

server.registerResource(
  "user details",
  new ResourceTemplate("users://{userId}/profile", {
    list: undefined,
  }),
  {
    title: "User Profile",
    description: "User Profile Details",
    inputSchema: z.object({
      userId: z.string(),
    }),
    outPutSchema: z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
      address: z.string(),
      phone: z.string(),
    }),
  },
  async (uri, { userId }) => {
    try {
      const user = await getUserById(String(userId));

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(user),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error retriving user detail of the id ${userId}`,
            mimeType: "text/plain",
          },
        ],
      };
    }
  }
);

server.registerPrompt(
  "create-fake-user",
  {
    title: "Create Fake User",
    description: "Creates a fake user with a given name",
    argsSchema: {
      name: z.string(),
    },
  },
  ({ name }) => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create a fake user with the name ${name}. The user should have given name and realistic other details`,
          },
        },
      ],
    };
  }
);

async function createUser(user: {
  name: string;
  email: string;
  address: string;
  phone: string;
}) {
  const users = await import("./data/users.json", {
    with: { type: "json" },
  }).then((m) => m.default);

  const id = users.length + 1;

  users.push({ id, ...user });

  await fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2));

  return id;
}

const getAllUsers = async (): Promise<User[]> => {
  const users = await import("./data/users.json", {
    with: { type: "json" },
  }).then((m) => m.default);

  return users;
};

const getUserById = async (id: string): Promise<User | null> => {
  const users = await getAllUsers();
  const user = users.find((u) => u.id === parseInt(id));

  if (user) {
    return user;
  }
  return null;
};

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main();
