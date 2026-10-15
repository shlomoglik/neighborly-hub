import "server-only";
import { eq } from "drizzle-orm";
import { apartments, buildings, floors, projects } from "../../../drizzle/schema";
import { db } from "./client";
import type { z } from "zod";
import { createStructure, deleteStructure, updateStructure } from "./structure-input";

type Create = z.infer<typeof createStructure>;
type Update = z.infer<typeof updateStructure>;
type Delete = z.infer<typeof deleteStructure>;

export async function createStructureRecord(input: Create) {
  switch (input.entity) {
    case "project": {
      const [row] = await db
        .insert(projects)
        .values({ name: input.name, city: input.city })
        .returning();
      return row;
    }
    case "building": {
      const [row] = await db
        .insert(buildings)
        .values({ name: input.name, projectId: input.projectId })
        .returning();
      return row;
    }
    case "floor": {
      const [row] = await db
        .insert(floors)
        .values({ number: input.number, buildingId: input.buildingId })
        .returning();
      return row;
    }
    case "apartment": {
      const [row] = await db
        .insert(apartments)
        .values({
        number: input.number,
        buildingId: input.buildingId,
        floorId: input.floorId,
      })
        .returning();
      return row;
    }
  }
}

export async function updateStructureRecord(input: Update) {
  switch (input.entity) {
    case "project": {
      const [row] = await db
        .update(projects)
        .set({ name: input.name, city: input.city })
        .where(eq(projects.id, input.id))
        .returning();
      return row ?? null;
    }
    case "building": {
      const [row] = await db
        .update(buildings)
        .set({ name: input.name })
        .where(eq(buildings.id, input.id))
        .returning();
      return row ?? null;
    }
    case "floor": {
      const [row] = await db
        .update(floors)
        .set({ number: input.number })
        .where(eq(floors.id, input.id))
        .returning();
      return row ?? null;
    }
    case "apartment": {
      const [row] = await db
        .update(apartments)
        .set({ number: input.number })
        .where(eq(apartments.id, input.id))
        .returning();
      return row ?? null;
    }
  }
}

export async function deleteStructureRecord(input: Delete) {
  switch (input.entity) {
    case "project": {
      const [row] = await db
        .delete(projects)
        .where(eq(projects.id, input.id))
        .returning({ id: projects.id });
      return row ?? null;
    }
    case "building": {
      const [row] = await db
        .delete(buildings)
        .where(eq(buildings.id, input.id))
        .returning({ id: buildings.id });
      return row ?? null;
    }
    case "floor": {
      const [row] = await db
        .delete(floors)
        .where(eq(floors.id, input.id))
        .returning({ id: floors.id });
      return row ?? null;
    }
    case "apartment": {
      const [row] = await db
        .delete(apartments)
        .where(eq(apartments.id, input.id))
        .returning({ id: apartments.id });
      return row ?? null;
    }
  }
}
