"use client";

import React, { useMemo, useState } from "react";
import { Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

import AdvancedDatePicker from "@/components/shared/advanced_date_picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userDailyActivityCall } from "@/components/networking";
import { DailyData } from "@/components/UsagePage/types";
import { formatNumberWithCommas } from "@/utils/dataUtils";
import { all_admin_roles } from "@/utils/roles";
import { usePaginatedDailyActivity } from "@/app/(dashboard)/usage/_components/hooks/usePaginatedDailyActivity";
import { computeCacheLeakage, pct, usd } from "./costOptimizationUtils";

interface CacheLeakageCardProps {
  accessToken: string | null;
  userId: string | null;
  userRole: string;
}

type DateRange = { from?: Date; to?: Date };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const HeadWithInfo = ({ label, info }: { label: string; info: string }) => (
  <span className="inline-flex items-center gap-1">
    {label}
    <Tooltip title={info}>
      <InfoCircleOutlined className="text-gray-400 text-xs" />
    </Tooltip>
  </span>
);

const CacheLeakageCard: React.FC<CacheLeakageCardProps> = ({ accessToken, userId, userRole }) => {
  const initialFrom = useMemo(() => new Date(new Date().getTime() - THIRTY_DAYS_MS), []);
  const initialTo = useMemo(() => new Date(), []);
  const [dateValue, setDateValue] = useState<DateRange>({ from: initialFrom, to: initialTo });

  const startTime = dateValue.from ?? null;
  const endTime = dateValue.to ?? null;
  const effectiveUserId = all_admin_roles.includes(userRole) ? null : userId;

  const { data, loading, isFetchingMore } = usePaginatedDailyActivity({
    fetchFn: userDailyActivityCall,
    args: [accessToken, startTime, endTime, effectiveUserId],
    enabled: !!accessToken && !!startTime && !!endTime,
  });

  const results = data.results as DailyData[];
  const leakage = useMemo(() => computeCacheLeakage(results), [results]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Cache leakage by virtual key</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Keys sending large volumes of uncached prompt tokens with a low cache-hit ratio are likely missing prompt
              caching. Estimated savings left is approximate: uncached prompt tokens priced at the portfolio&apos;s
              realized cache-read discount.
            </p>
          </div>
          <AdvancedDatePicker value={dateValue} onValueChange={(v) => setDateValue(v)} />
        </div>
      </CardHeader>
      <CardContent>
        {leakage.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {loading || isFetchingMore ? "Loading..." : "No key usage in this range."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead className="text-right">
                  <HeadWithInfo
                    label="Uncached prompt tokens"
                    info="Input tokens in the selected range that were neither read from nor written to the prompt cache"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <HeadWithInfo
                    label="Cache hit ratio"
                    info="Share of this key's total input tokens that were served from the prompt cache"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <HeadWithInfo
                    label="Realized caching savings"
                    info="Dollars this key actually saved because cached input was billed at the discounted cache-read rate"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <HeadWithInfo
                    label="Est. savings left"
                    info="Approximate dollars this key could still save if its uncached input had hit the cache at the portfolio's realized discount"
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leakage.rows.map((row) => (
                <TableRow key={row.apiKey}>
                  <TableCell className="font-medium">
                    {row.keyAlias || `${row.apiKey.slice(0, 8)}...`}
                    {row.teamId && <span className="ml-1 text-xs text-muted-foreground">({row.teamId})</span>}
                  </TableCell>
                  <TableCell className="text-right">{formatNumberWithCommas(row.uncachedPromptTokens)}</TableCell>
                  <TableCell className="text-right">{pct(row.cacheHitRatio)}</TableCell>
                  <TableCell className="text-right">{usd(row.realizedCachingSavings)}</TableCell>
                  <TableCell className="text-right">
                    {row.estSavingsLeft == null ? "—" : usd(row.estSavingsLeft)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default CacheLeakageCard;
