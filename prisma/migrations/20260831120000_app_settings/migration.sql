-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "staff_can_see_pay" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
