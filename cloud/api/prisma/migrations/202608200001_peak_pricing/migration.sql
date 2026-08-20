-- AlterTable: LogicalModel 增加高峰时段费率与时段配置
ALTER TABLE "LogicalModel" ADD COLUMN "peakInputPointsPerMillion" BIGINT;
ALTER TABLE "LogicalModel" ADD COLUMN "peakCachedInputPointsPerMillion" BIGINT;
ALTER TABLE "LogicalModel" ADD COLUMN "peakOutputPointsPerMillion" BIGINT;
ALTER TABLE "LogicalModel" ADD COLUMN "peakWindowsJson" JSONB;
