-- CreateTable
CREATE TABLE "pickup_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "slotIntervalMin" INTEGER NOT NULL DEFAULT 15,
    "leadTimeMin" INTEGER NOT NULL DEFAULT 30,
    "visibleDays" INTEGER NOT NULL DEFAULT 2,
    "capacityPerSlot" INTEGER,
    "weeklyHours" JSONB NOT NULL DEFAULT '{}',
    "dateOverrides" JSONB NOT NULL DEFAULT '[]',
    "pickupAddress" TEXT,
    "pickupMapsUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_settings_pkey" PRIMARY KEY ("id")
);
