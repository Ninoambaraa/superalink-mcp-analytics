import { BigQuery } from "@google-cloud/bigquery";

const rawCredentials = process.env.GOOGLE_CLOUD_CREDENTIALS;

if (!rawCredentials) {
  throw new Error(
    "GOOGLE_CLOUD_CREDENTIALS environment variable is required to query BigQuery."
  );
}

let credentials: Record<string, unknown>;

try {
  const tryParse = (candidate: string): Record<string, unknown> | null => {
    try {
      const data=  JSON.parse(candidate);
      return data
    } catch {
      return null;
    }
  };

  const normalize = (input: string): string => {
    const trimmed = input.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      return trimmed;
    }

    const stripWrappingQuote = (value: string, quote: string): string => {
      if (value.startsWith(quote) && value.endsWith(quote)) {
        return value.slice(1, -1);
      }
      return value;
    };

    let candidate = stripWrappingQuote(trimmed, '"');
    candidate = stripWrappingQuote(candidate, "'");
    return candidate.trim();
  };

  const normalized = normalize(rawCredentials);
  const attempts = [
    rawCredentials,
    normalized,
    normalized.replace(/\\"/g, '"'),
  ];

  let parsed: Record<string, unknown> | null = null;
  for (const candidate of attempts) {
    parsed = tryParse(candidate);
    if (parsed) break;
  }

  if (!parsed) {
    throw new Error("GOOGLE_CLOUD_CREDENTIALS parse failed");
  }

  credentials = parsed;

  const privateKey = (credentials as { private_key?: unknown }).private_key;
  if (typeof privateKey === "string" && privateKey.includes("\\n")) {
    (credentials as { private_key: string }).private_key = privateKey.replace(
      /\\n/g,
      "\n"
    );
  }
} catch (error) {
  throw new Error(
    "GOOGLE_CLOUD_CREDENTIALS does not contain valid JSON credentials."
  );
}

if (
  !credentials ||
  typeof credentials !== "object" ||
  typeof (credentials as { client_email?: unknown }).client_email !== "string" ||
  typeof (credentials as { private_key?: unknown }).private_key !== "string"
) {
  throw new Error(
    "GOOGLE_CLOUD_CREDENTIALS must include client_email and private_key."
  );
}

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT_ID ?? "analytics-test-470206";

const EVENTS_TABLE_PLACEHOLDER = "__EVENTS_TABLE__";

const DEFAULT_EVENTS_TABLE =
  process.env.BIGQUERY_EVENTS_TABLE ??
  "analytics-test-470206.analytics_422582330.events_*";

const DEV_EVENTS_TABLE =
  process.env.BIGQUERY_DEV_EVENTS_TABLE ?? DEFAULT_EVENTS_TABLE;

const MAX_ROWS = 5000;
const DEFAULT_LIMIT = 500;
const DEFAULT_PAGE = 1;

const applyEventsTable = (template: string, table: string): string =>
  template.replaceAll(EVENTS_TABLE_PLACEHOLDER, table);

const bigquery = new BigQuery({
  projectId,
  credentials,
});

const PURCHASE_EVENT_PARAM_KEYS = [
  "transaction_id",
  "ignore_referrer",
  "session_engaged",
  "page_referrer",
  "customer_email",
  "ga_session_id",
  "currency",
  "engagement_time_msec",
  "page_path",
  "debug_mode",
  "page_location",
  "batch_page_id",
  "batch_ordering_id",
  "is_allow_cookies",
  "engaged_session_event",
  "customer_id",
  "unique_order_id",
  "order_discount_usd",
  "affiliation",
  "coupon",
  "order_promo_code",
  "value_usd",
  "user_type",
  "custom_profile_id",
  "value",
  "page_title",
  "ga_session_number",
  "payment_type",
  "customer_status",
] as const;

type PurchaseEventParamKey = (typeof PURCHASE_EVENT_PARAM_KEYS)[number];

type PurchaseEventValue = string | number | null;

export interface PurchaseEventRecord {
  eventDate: string;
  transaction_id?: PurchaseEventValue;
  ignore_referrer?: PurchaseEventValue;
  session_engaged?: PurchaseEventValue;
  page_referrer?: PurchaseEventValue;
  customer_email?: PurchaseEventValue;
  ga_session_id?: PurchaseEventValue;
  currency?: PurchaseEventValue;
  engagement_time_msec?: PurchaseEventValue;
  page_path?: PurchaseEventValue;
  debug_mode?: PurchaseEventValue;
  page_location?: PurchaseEventValue;
  batch_page_id?: PurchaseEventValue;
  batch_ordering_id?: PurchaseEventValue;
  is_allow_cookies?: PurchaseEventValue;
  engaged_session_event?: PurchaseEventValue;
  customer_id?: PurchaseEventValue;
  unique_order_id?: PurchaseEventValue;
  order_discount_usd?: PurchaseEventValue;
  affiliation?: PurchaseEventValue;
  coupon?: PurchaseEventValue;
  order_promo_code?: PurchaseEventValue;
  value_usd?: PurchaseEventValue;
  user_type?: PurchaseEventValue;
  custom_profile_id?: PurchaseEventValue;
  value?: PurchaseEventValue;
  page_title?: PurchaseEventValue;
  ga_session_number?: PurchaseEventValue;
  payment_type?: PurchaseEventValue;
  customer_status?: PurchaseEventValue;
}

export interface PurchaseSessionDetail {
  transactionId: string | null;
  merchantOrderId: string | null;
  paymentType: string | null;
  currency: string | null;
  grossRevenue: number | null;
  taxAmount: number | null;
  shippingAmount: number | null;
  discountAmount: number | null;
  couponCode: string | null;
  affiliation: string | null;
  userPseudoId: string | null;
  userId: string | null;
  gaSessionId: number | null;
  purchaseTimestamp: string | null;
  eventDate: string | null;
  itemsLineCount: number | null;
  itemsQuantity: number | null;
  purchaseGclid: string | null;
  purchaseDclid: string | null;
  sessionKey: string | null;
  sessionStartTime: string | null;
  sessionEndTime: string | null;
  sessionDurationSec: number | null;
  sessionEventDate: string | null;
  sessionEventHour: number | null;
  sessionPageviewsCount: number | null;
  sessionEventsCount: number | null;
  sessionEngagementTimeMsec: number | null;
  sessionIsEngaged: boolean | null;
  sessionBounceLike: boolean | null;
  sessionLandingUrl: string | null;
  sessionLandingTitle: string | null;
  sessionExitUrl: string | null;
  sessionLandingPath: string | null;
  sessionUtmSourceStart: string | null;
  sessionUtmMediumStart: string | null;
  sessionUtmCampaignStart: string | null;
  sessionUtmSourceLanding: string | null;
  sessionUtmMediumLanding: string | null;
  sessionUtmCampaignLanding: string | null;
  sessionUtmTermLanding: string | null;
  sessionUtmContentLanding: string | null;
  sessionRefSource: string | null;
  sessionRefMedium: string | null;
  sessionGclid: string | null;
  sessionDclid: string | null;
  sessionTrafficSourceType: string | null;
  sessionTrafficSource: string | null;
  sessionTrafficMedium: string | null;
  sessionTrafficCampaign: string | null;
  sessionDeviceCategory: string | null;
  sessionOperatingSystem: string | null;
  sessionBrowser: string | null;
  sessionGeoCountry: string | null;
  sessionGeoRegion: string | null;
  sessionGeoCity: string | null;
  sessionTransactionsCount: number | null;
  sessionConversionFlag: boolean | null;
  sessionHasSessionStart: boolean | null;
  sessionUpdatedAt: string | null;
  isRefund: boolean | null;
  refundAmount: number | null;
  parentTransactionId: string | null;
  ingestedAt: string | null;
}

const EVENT_PARAM_KEYS_QUERY_TEMPLATE = `
  SELECT DISTINCT ep.key
  FROM \`${EVENTS_TABLE_PLACEHOLDER}\`,
  UNNEST(event_params) AS ep
  WHERE event_name = @eventName
  LIMIT @limit
`;

const PURCHASE_EVENTS_QUERY_TEMPLATE = `
  SELECT
    FORMAT_DATE('%Y-%m-%d', PARSE_DATE('%Y%m%d', event_date)) AS event_date,
    event_params
  FROM \`${EVENTS_TABLE_PLACEHOLDER}\`
  WHERE event_name = @eventName
    AND (@startDate IS NULL OR PARSE_DATE('%Y%m%d', event_date) >= @startDate)
    AND (@endDate IS NULL OR PARSE_DATE('%Y%m%d', event_date) <= @endDate)
`;

const PURCHASE_SESSIONS_QUERY_TEMPLATE = /* sql */ `
  WITH purchases AS (
    SELECT
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'transaction_id'
      ) AS transaction_id,
      e.user_pseudo_id,
      e.user_id,
      (
        SELECT ep.value.int_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'ga_session_id'
      ) AS ga_session_id,
      TIMESTAMP_MICROS(e.event_timestamp) AS purchase_ts,
      DATE(TIMESTAMP_MICROS(e.event_timestamp), 'Asia/Makassar') AS event_date,
      CAST(
        COALESCE(
          (
            SELECT ep.value.double_value
            FROM UNNEST(e.event_params) ep
            WHERE ep.key = 'value'
          ),
          CAST(
            (
              SELECT ep.value.int_value
              FROM UNNEST(e.event_params) ep
              WHERE ep.key = 'value'
            ) AS FLOAT64
          )
        ) AS NUMERIC
      ) AS gross_revenue,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'currency'
      ) AS currency,
      CAST(
        COALESCE(
          (
            SELECT ep.value.double_value
            FROM UNNEST(e.event_params) ep
            WHERE ep.key = 'tax'
          ),
          CAST(
            (
              SELECT ep.value.int_value
              FROM UNNEST(e.event_params) ep
              WHERE ep.key = 'tax'
            ) AS FLOAT64
          )
        ) AS NUMERIC
      ) AS tax_amount,
      CAST(
        COALESCE(
          (
            SELECT ep.value.double_value
            FROM UNNEST(e.event_params) ep
            WHERE ep.key = 'shipping'
          ),
          CAST(
            (
              SELECT ep.value.int_value
              FROM UNNEST(e.event_params) ep
              WHERE ep.key = 'shipping'
            ) AS FLOAT64
          )
        ) AS NUMERIC
      ) AS shipping_amount,
      CAST(
        COALESCE(
          (
            SELECT ep.value.double_value
            FROM UNNEST(e.event_params) ep
            WHERE ep.key = 'discount'
          ),
          CAST(
            (
              SELECT ep.value.int_value
              FROM UNNEST(e.event_params) ep
              WHERE ep.key = 'discount'
            ) AS FLOAT64
          )
        ) AS NUMERIC
      ) AS discount_amount,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'coupon'
      ) AS coupon_code,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'affiliation'
      ) AS affiliation,
      COALESCE(
        (
          SELECT ep.value.string_value
          FROM UNNEST(e.event_params) ep
          WHERE ep.key = 'merchant_order_id'
        ),
        (
          SELECT ep.value.string_value
          FROM UNNEST(e.event_params) ep
          WHERE ep.key = 'unique_order_id'
        )
      ) AS merchant_order_id,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'payment_type'
      ) AS payment_type,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'gclid'
      ) AS gclid,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'dclid'
      ) AS dclid,
      ARRAY_LENGTH(e.items) AS items_line_count,
      (
        SELECT
          SUM(CAST(COALESCE(i.quantity, 1) AS INT64))
        FROM UNNEST(e.items) AS i
      ) AS items_qty
    FROM \`${EVENTS_TABLE_PLACEHOLDER}\` AS e
    WHERE e.event_name = 'purchase'
      AND (@startDate IS NULL OR DATE(TIMESTAMP_MICROS(e.event_timestamp), 'Asia/Makassar') >= @startDate)
      AND (@endDate IS NULL OR DATE(TIMESTAMP_MICROS(e.event_timestamp), 'Asia/Makassar') <= @endDate)
  ),
  source AS (
    SELECT
      p.transaction_id,
      CONCAT(p.user_pseudo_id, '.', CAST(p.ga_session_id AS STRING)) AS session_key,
      p.user_pseudo_id,
      p.user_id,
      p.ga_session_id,
      COALESCE(p.user_id, p.user_pseudo_id) AS user_key,
      p.purchase_ts,
      p.event_date,
      p.gross_revenue,
      p.currency,
      p.tax_amount,
      p.shipping_amount,
      p.discount_amount,
      p.coupon_code,
      p.affiliation,
      p.merchant_order_id,
      p.payment_type,
      p.items_line_count,
      p.items_qty,
      p.gclid,
      p.dclid,
      FALSE AS is_refund,
      CAST(NULL AS NUMERIC) AS refund_amount,
      CAST(NULL AS STRING) AS parent_transaction_id,
      CURRENT_TIMESTAMP() AS ingested_at
    FROM purchases AS p
    WHERE p.transaction_id IS NOT NULL
  ),
  events_base AS (
    SELECT
      DATE(TIMESTAMP_MICROS(e.event_timestamp), 'Asia/Makassar') AS day_tz,
      e.event_timestamp,
      TIMESTAMP_MICROS(e.event_timestamp) AS event_ts,
      e.event_name,
      e.user_pseudo_id,
      e.user_id,
      (
        SELECT ep.value.int_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'ga_session_id'
      ) AS ga_session_id,
      (
        SELECT ep.value.int_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'ga_session_number'
      ) AS ga_session_number,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'page_location'
      ) AS page_location,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'page_referrer'
      ) AS page_referrer,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'page_title'
      ) AS page_title,
      (
        SELECT ep.value.int_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'engagement_time_msec'
      ) AS engagement_time_msec,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'source'
      ) AS source_start,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'medium'
      ) AS medium_start,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'campaign'
      ) AS campaign_start,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'gclid'
      ) AS gclid_start,
      (
        SELECT ep.value.string_value
        FROM UNNEST(e.event_params) ep
        WHERE ep.key = 'dclid'
      ) AS dclid_start,
      e.device.category AS device_category,
      e.device.operating_system AS operating_system,
      e.device.web_info.browser AS browser,
      e.geo.country AS geo_country,
      e.geo.region AS geo_region,
      e.geo.city AS geo_city
    FROM \`${EVENTS_TABLE_PLACEHOLDER}\` AS e
    WHERE (@startDate IS NULL OR DATE(TIMESTAMP_MICROS(e.event_timestamp), 'Asia/Makassar') >= @startDate)
      AND (@endDate IS NULL OR DATE(TIMESTAMP_MICROS(e.event_timestamp), 'Asia/Makassar') <= @endDate)
  ),
  sessions_base AS (
    SELECT
      user_pseudo_id,
      ga_session_id,
      MIN(event_ts) AS session_start_ts,
      MAX(event_ts) AS session_end_ts,
      COUNT(*) AS events_count,
      ANY_VALUE(user_id) AS any_user_id
    FROM events_base
    GROUP BY user_pseudo_id, ga_session_id
  ),
  sessions_base_final AS (
    SELECT
      DATE(session_start_ts, 'Asia/Makassar') AS event_date,
      sb.*
    FROM sessions_base AS sb
  ),
  starts AS (
    SELECT
      user_pseudo_id,
      ga_session_id,
      MIN(event_ts) AS session_start_event_ts,
      ANY_VALUE(source_start) AS utm_source_start,
      ANY_VALUE(medium_start) AS utm_medium_start,
      ANY_VALUE(campaign_start) AS utm_campaign_start,
      ANY_VALUE(gclid_start) AS gclid_start,
      ANY_VALUE(dclid_start) AS dclid_start
    FROM events_base
    WHERE event_name = 'session_start'
    GROUP BY user_pseudo_id, ga_session_id
  ),
  session_pages AS (
    SELECT
      user_pseudo_id,
      ga_session_id,
      ARRAY_AGG(
        IF(event_name = 'page_view', page_location, NULL) IGNORE NULLS
        ORDER BY event_ts ASC
      )[OFFSET(0)] AS landing_url,
      ARRAY_AGG(
        IF(event_name = 'page_view', page_title, NULL) IGNORE NULLS
        ORDER BY event_ts ASC
      )[OFFSET(0)] AS landing_title,
      ARRAY_AGG(
        IF(event_name = 'page_view', page_location, NULL) IGNORE NULLS
        ORDER BY event_ts DESC
      )[OFFSET(0)] AS exit_url,
      COUNTIF(event_name = 'page_view') AS pageviews_count
    FROM events_base
    GROUP BY user_pseudo_id, ga_session_id
  ),
  utm_from_landing AS (
    SELECT
      sp.user_pseudo_id,
      sp.ga_session_id,
      sp.landing_url,
      sp.landing_title,
      REGEXP_EXTRACT(sp.landing_url, r'[?&]utm_source=([^&#]*)') AS utm_source_lp,
      REGEXP_EXTRACT(sp.landing_url, r'[?&]utm_medium=([^&#]*)') AS utm_medium_lp,
      REGEXP_EXTRACT(sp.landing_url, r'[?&]utm_campaign=([^&#]*)') AS utm_campaign_lp,
      REGEXP_EXTRACT(sp.landing_url, r'[?&]utm_term=([^&#]*)') AS utm_term_lp,
      REGEXP_EXTRACT(sp.landing_url, r'[?&]utm_content=([^&#]*)') AS utm_content_lp,
      REGEXP_EXTRACT(sp.landing_url, r'[?&]gclid=([^&#]*)') AS gclid_lp,
      REGEXP_EXTRACT(sp.landing_url, r'[?&]dclid=([^&#]*)') AS dclid_lp
    FROM session_pages AS sp
  ),
  first_ext_ref AS (
    SELECT
      user_pseudo_id,
      ga_session_id,
      ARRAY_AGG(
        page_referrer IGNORE NULLS
        ORDER BY event_ts ASC
      )[OFFSET(0)] AS first_referrer
    FROM (
      SELECT
        user_pseudo_id,
        ga_session_id,
        event_ts,
        page_referrer
      FROM events_base
      WHERE event_name = 'page_view'
        AND page_referrer IS NOT NULL
        AND page_referrer != ''
        AND NOT REGEXP_CONTAINS(
          LOWER(COALESCE(REGEXP_EXTRACT(page_referrer, r'^https?://([^/:]+)'), '')),
          r'(^|\\.)superalink\\.com$'
        )
    )
    GROUP BY user_pseudo_id, ga_session_id
  ),
  ref_derived AS (
    SELECT
      fr.user_pseudo_id,
      fr.ga_session_id,
      fr.first_referrer,
      LOWER(REGEXP_EXTRACT(fr.first_referrer, r'^https?://([^/:]+)')) AS ref_domain,
      CASE
        WHEN fr.first_referrer IS NULL THEN NULL
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?google\\.') THEN 'organic'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?bing\\.') THEN 'organic'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?search\\.yahoo\\.') THEN 'organic'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?duckduckgo\\.') THEN 'organic'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?baidu\\.') THEN 'organic'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?yandex\\.') THEN 'organic'
        ELSE 'referral'
      END AS ref_medium,
      CASE
        WHEN fr.first_referrer IS NULL THEN NULL
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?google\\.') THEN 'google'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?bing\\.') THEN 'bing'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?search\\.yahoo\\.') THEN 'yahoo'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?duckduckgo\\.') THEN 'duckduckgo'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?baidu\\.') THEN 'baidu'
        WHEN REGEXP_CONTAINS(fr.first_referrer, r'(?i)://(www\\.)?yandex\\.') THEN 'yandex'
        ELSE LOWER(REGEXP_EXTRACT(fr.first_referrer, r'^https?://([^/:]+)'))
      END AS ref_source
    FROM first_ext_ref AS fr
  ),
  session_metrics AS (
    SELECT
      user_pseudo_id,
      ga_session_id,
      COUNT(*) AS events_count,
      SUM(COALESCE(engagement_time_msec, 0)) AS engagement_time_msec_sum,
      COUNTIF(event_name = 'purchase') AS transactions_count
    FROM events_base
    GROUP BY user_pseudo_id, ga_session_id
  ),
  session_device_geo AS (
    SELECT
      user_pseudo_id,
      ga_session_id,
      ARRAY_AGG(
        STRUCT(device_category, operating_system, browser, geo_country, geo_region, geo_city)
        ORDER BY event_ts ASC
        LIMIT 1
      )[OFFSET(0)] AS dg
    FROM events_base
    GROUP BY user_pseudo_id, ga_session_id
  ),
  has_session_start AS (
    SELECT
      user_pseudo_id,
      ga_session_id,
      COUNTIF(event_name = 'session_start') > 0 AS has_session_start
    FROM events_base
    GROUP BY user_pseudo_id, ga_session_id
  ),
  sessions_final AS (
    SELECT
      CONCAT(sb.user_pseudo_id, '.', CAST(sb.ga_session_id AS STRING)) AS session_key,
      COALESCE(sb.any_user_id, sb.user_pseudo_id) AS user_key,
      sb.user_pseudo_id,
      sb.ga_session_id,
      sb.session_start_ts,
      sb.session_end_ts,
      SAFE_DIVIDE(
        TIMESTAMP_DIFF(sb.session_end_ts, sb.session_start_ts, MICROSECOND),
        1e6
      ) AS session_duration_sec,
      sb.event_date,
      EXTRACT(HOUR FROM sb.session_start_ts) AS event_hour,
      sp.pageviews_count,
      sm.events_count,
      sm.engagement_time_msec_sum,
      (sm.engagement_time_msec_sum >= 10000 OR sp.pageviews_count >= 2) AS is_engaged_session,
      (
        sp.pageviews_count = 1
        AND NOT (
          sm.engagement_time_msec_sum >= 10000
          OR sp.pageviews_count >= 2
        )
      ) AS bounce_like,
      sp.landing_url,
      sp.landing_title,
      sp.exit_url,
      REGEXP_EXTRACT(sp.landing_url, r'^https?://[^/]+(/.*)$') AS landing_path,
      st.utm_source_start,
      st.utm_medium_start,
      st.utm_campaign_start,
      ul.utm_source_lp,
      ul.utm_medium_lp,
      ul.utm_campaign_lp,
      ul.utm_term_lp,
      ul.utm_content_lp,
      rd.ref_source,
      rd.ref_medium,
      COALESCE(st.gclid_start, ul.gclid_lp) AS gclid,
      COALESCE(st.dclid_start, ul.dclid_lp) AS dclid,
      CASE
        WHEN st.utm_source_start IS NOT NULL OR st.utm_medium_start IS NOT NULL THEN 'session_start'
        WHEN ul.utm_source_lp IS NOT NULL OR ul.utm_medium_lp IS NOT NULL THEN 'first_pageview_utm'
        WHEN rd.ref_source IS NOT NULL THEN 'referrer'
        ELSE 'direct'
      END AS traffic_source_type,
      COALESCE(st.utm_source_start, ul.utm_source_lp, rd.ref_source, '(direct)') AS traffic_source,
      COALESCE(st.utm_medium_start, ul.utm_medium_lp, rd.ref_medium, '(none)') AS traffic_medium,
      COALESCE(st.utm_campaign_start, ul.utm_campaign_lp, '(not set)') AS traffic_campaign,
      sdg.dg.device_category AS device_category,
      sdg.dg.operating_system AS operating_system,
      sdg.dg.browser AS browser,
      sdg.dg.geo_country AS geo_country,
      sdg.dg.geo_region AS geo_region,
      sdg.dg.geo_city AS geo_city,
      sm.transactions_count,
      (sm.transactions_count > 0) AS conversion_flag,
      hss.has_session_start,
      CURRENT_TIMESTAMP() AS updated_at
    FROM sessions_base_final AS sb
    LEFT JOIN starts AS st
      ON st.user_pseudo_id = sb.user_pseudo_id
      AND st.ga_session_id = sb.ga_session_id
    LEFT JOIN session_pages AS sp
      ON sp.user_pseudo_id = sb.user_pseudo_id
      AND sp.ga_session_id = sb.ga_session_id
    LEFT JOIN utm_from_landing AS ul
      ON ul.user_pseudo_id = sb.user_pseudo_id
      AND ul.ga_session_id = sb.ga_session_id
    LEFT JOIN ref_derived AS rd
      ON rd.user_pseudo_id = sb.user_pseudo_id
      AND rd.ga_session_id = sb.ga_session_id
    LEFT JOIN session_metrics AS sm
      ON sm.user_pseudo_id = sb.user_pseudo_id
      AND sm.ga_session_id = sb.ga_session_id
    LEFT JOIN session_device_geo AS sdg
      ON sdg.user_pseudo_id = sb.user_pseudo_id
      AND sdg.ga_session_id = sb.ga_session_id
    LEFT JOIN has_session_start AS hss
      ON hss.user_pseudo_id = sb.user_pseudo_id
      AND hss.ga_session_id = sb.ga_session_id
  )
  SELECT
    source.transaction_id AS transactionId,
    source.merchant_order_id AS merchantOrderId,
    source.payment_type AS paymentType,
    source.currency AS currency,
    CAST(source.gross_revenue AS FLOAT64) AS grossRevenue,
    CAST(source.tax_amount AS FLOAT64) AS taxAmount,
    CAST(source.shipping_amount AS FLOAT64) AS shippingAmount,
    CAST(source.discount_amount AS FLOAT64) AS discountAmount,
    source.coupon_code AS couponCode,
    source.affiliation AS affiliation,
    source.user_pseudo_id AS userPseudoId,
    source.user_id AS userId,
    source.ga_session_id AS gaSessionId,
    FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6S%Ez', source.purchase_ts) AS purchaseTimestamp,
    CAST(source.event_date AS STRING) AS eventDate,
    source.items_line_count AS itemsLineCount,
    source.items_qty AS itemsQuantity,
    source.gclid AS purchaseGclid,
    source.dclid AS purchaseDclid,
    source.session_key AS sessionKey,
    FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6S%Ez', sessions.session_start_ts) AS sessionStartTime,
    FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6S%Ez', sessions.session_end_ts) AS sessionEndTime,
    sessions.session_duration_sec AS sessionDurationSec,
    CAST(sessions.event_date AS STRING) AS sessionEventDate,
    sessions.event_hour AS sessionEventHour,
    sessions.pageviews_count AS sessionPageviewsCount,
    sessions.events_count AS sessionEventsCount,
    sessions.engagement_time_msec_sum AS sessionEngagementTimeMsec,
    sessions.is_engaged_session AS sessionIsEngaged,
    sessions.bounce_like AS sessionBounceLike,
    sessions.landing_url AS sessionLandingUrl,
    sessions.landing_title AS sessionLandingTitle,
    sessions.exit_url AS sessionExitUrl,
    sessions.landing_path AS sessionLandingPath,
    sessions.utm_source_start AS sessionUtmSourceStart,
    sessions.utm_medium_start AS sessionUtmMediumStart,
    sessions.utm_campaign_start AS sessionUtmCampaignStart,
    sessions.utm_source_lp AS sessionUtmSourceLanding,
    sessions.utm_medium_lp AS sessionUtmMediumLanding,
    sessions.utm_campaign_lp AS sessionUtmCampaignLanding,
    sessions.utm_term_lp AS sessionUtmTermLanding,
    sessions.utm_content_lp AS sessionUtmContentLanding,
    sessions.ref_source AS sessionRefSource,
    sessions.ref_medium AS sessionRefMedium,
    sessions.gclid AS sessionGclid,
    sessions.dclid AS sessionDclid,
    sessions.traffic_source_type AS sessionTrafficSourceType,
    sessions.traffic_source AS sessionTrafficSource,
    sessions.traffic_medium AS sessionTrafficMedium,
    sessions.traffic_campaign AS sessionTrafficCampaign,
    sessions.device_category AS sessionDeviceCategory,
    sessions.operating_system AS sessionOperatingSystem,
    sessions.browser AS sessionBrowser,
    sessions.geo_country AS sessionGeoCountry,
    sessions.geo_region AS sessionGeoRegion,
    sessions.geo_city AS sessionGeoCity,
    sessions.transactions_count AS sessionTransactionsCount,
    sessions.conversion_flag AS sessionConversionFlag,
    sessions.has_session_start AS sessionHasSessionStart,
    FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6S%Ez', sessions.updated_at) AS sessionUpdatedAt,
    source.is_refund AS isRefund,
    CAST(source.refund_amount AS FLOAT64) AS refundAmount,
    source.parent_transaction_id AS parentTransactionId,
    FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6S%Ez', source.ingested_at) AS ingestedAt
  FROM source
  LEFT JOIN sessions_final AS sessions
    ON source.session_key = sessions.session_key
  WHERE (@startDate IS NULL OR source.event_date >= @startDate)
    AND (@endDate IS NULL OR source.event_date <= @endDate)
  ORDER BY source.purchase_ts
  {{LIMIT_CLAUSE}}
`;

/**
 * Fetch distinct event parameter keys for a given event.
 */
export const getEventParamKeys = async (
  eventName = "purchase",
  limit = 100
): Promise<string[]> => {
  const query = applyEventsTable(
    EVENT_PARAM_KEYS_QUERY_TEMPLATE,
    DEFAULT_EVENTS_TABLE
  );

  const [job] = await bigquery.createQueryJob({
    query,
    params: { eventName, limit },
  });

  const [rows] = await job.getQueryResults();

  return rows
    .map((row) => row.key as string | null | undefined)
    .filter((key): key is string => Boolean(key));
};

const parseEventParamValue = (param: any): PurchaseEventValue => {
  if (!param?.value) return null;
  const { string_value, int_value, float_value, double_value } = param.value;

  if (typeof string_value === "string" && string_value.length > 0) {
    return string_value;
  }
  if (typeof int_value === "number") {
    return int_value;
  }
  if (typeof float_value === "number") {
    return float_value;
  }
  if (typeof double_value === "number") {
    return double_value;
  }

  return null;
};

/**
 * Retrieve purchase events filtered by optional date range.
 * Dates should be provided as ISO strings (YYYY-MM-DD).
 */
export const getPurchaseEventsByDateRange = async (
  options: {
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<PurchaseEventRecord[]> => {
  const { startDate, endDate } = options;

  const query = applyEventsTable(
    PURCHASE_EVENTS_QUERY_TEMPLATE,
    DEFAULT_EVENTS_TABLE
  );

  const params: Record<string, string | null> = {
    eventName: "purchase",
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  };

  const types = {
    startDate: "DATE",
    endDate: "DATE",
  };

  const [job] = await bigquery.createQueryJob({
    query,
    params,
    types,
  });

  const [rows] = await job.getQueryResults();

  return rows.map((row) => {
    const record: PurchaseEventRecord = {
      eventDate: row.event_date as string,
    };

    const paramsArray = Array.isArray(row.event_params) ? row.event_params : [];

    for (const param of paramsArray) {
      const key = param?.key as string | undefined;
      if (
        key &&
        PURCHASE_EVENT_PARAM_KEYS.includes(key as PurchaseEventParamKey)
      ) {
        record[key as PurchaseEventParamKey] = parseEventParamValue(param);
      }
    }

    return record;
  });
};

/**
 * Retrieve detailed purchase and session data for a date range.
 */
const fetchPurchaseSessions = async (
  eventsTable: string,
  options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    page?: number;
    pageSize?: number;
    truncateStrings?: boolean;
  } = {}
): Promise<PurchaseSessionDetail[]> => {
  const { startDate, endDate, limit, page, pageSize, truncateStrings = true } = options;

  const effectivePageSize =
    typeof pageSize === "number" && Number.isFinite(pageSize) && pageSize > 0
      ? Math.min(pageSize, MAX_ROWS)
      : DEFAULT_LIMIT;

  const effectivePage =
    typeof page === "number" && Number.isFinite(page) && page > 0
      ? Math.floor(page)
      : DEFAULT_PAGE;

  const effectiveLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.min(limit, MAX_ROWS)
      : effectivePageSize;

  const offset = (effectivePage - 1) * effectivePageSize;

  const limitClause =
    typeof effectiveLimit === "number" && Number.isFinite(effectiveLimit)
      ? "LIMIT @limit"
      : "";

  const offsetClause =
    typeof offset === "number" && Number.isFinite(offset) && offset > 0
      ? "OFFSET @offset"
      : "";

  const query = applyEventsTable(
    PURCHASE_SESSIONS_QUERY_TEMPLATE.replace(
      "{{LIMIT_CLAUSE}}",
      [limitClause, offsetClause].filter(Boolean).join(" ")
    ),
    eventsTable
  );

  const params: Record<string, string | number | null> = {
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  };
  if (limitClause) {
    params.limit = effectiveLimit;
  }
  if (offsetClause) {
    params.offset = offset;
  }

  const types: Record<string, string> = {
    startDate: "DATE",
    endDate: "DATE",
  };
  if (limitClause) {
    types.limit = "INT64";
  }
  if (offsetClause) {
    types.offset = "INT64";
  }

  const [job] = await bigquery.createQueryJob({
    query,
    params,
    types,
  });

  const [rows] = await job.getQueryResults();

  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const maybeTrimString = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const str = String(value);
    if (!truncateStrings) return str;
    return str.length > 200 ? `${str.slice(0, 197)}...` : str;
  };

  return rows.map((row) => ({
    transactionId: maybeTrimString(row.transactionId),
    merchantOrderId: maybeTrimString(row.merchantOrderId),
    paymentType: maybeTrimString(row.paymentType),
    currency: maybeTrimString(row.currency),
    grossRevenue: toNumber(row.grossRevenue),
    taxAmount: toNumber(row.taxAmount),
    shippingAmount: toNumber(row.shippingAmount),
    discountAmount: toNumber(row.discountAmount),
    couponCode: maybeTrimString(row.couponCode),
    affiliation: maybeTrimString(row.affiliation),
    userPseudoId: maybeTrimString(row.userPseudoId),
    userId: maybeTrimString(row.userId),
    gaSessionId: toNumber(row.gaSessionId),
    purchaseTimestamp: maybeTrimString(row.purchaseTimestamp),
    eventDate: maybeTrimString(row.eventDate),
    itemsLineCount: toNumber(row.itemsLineCount),
    itemsQuantity: toNumber(row.itemsQuantity),
    purchaseGclid: maybeTrimString(row.purchaseGclid),
    purchaseDclid: maybeTrimString(row.purchaseDclid),
    sessionKey: maybeTrimString(row.sessionKey),
    sessionStartTime: maybeTrimString(row.sessionStartTime),
    sessionEndTime: maybeTrimString(row.sessionEndTime),
    sessionDurationSec: toNumber(row.sessionDurationSec),
    sessionEventDate: maybeTrimString(row.sessionEventDate),
    sessionEventHour: toNumber(row.sessionEventHour),
    sessionPageviewsCount: toNumber(row.sessionPageviewsCount),
    sessionEventsCount: toNumber(row.sessionEventsCount),
    sessionEngagementTimeMsec: toNumber(row.sessionEngagementTimeMsec),
    sessionIsEngaged:
      row.sessionIsEngaged === null || row.sessionIsEngaged === undefined
        ? null
        : Boolean(row.sessionIsEngaged),
    sessionBounceLike:
      row.sessionBounceLike === null || row.sessionBounceLike === undefined
        ? null
        : Boolean(row.sessionBounceLike),
    sessionLandingUrl: maybeTrimString(row.sessionLandingUrl),
    sessionLandingTitle: maybeTrimString(row.sessionLandingTitle),
    sessionExitUrl: maybeTrimString(row.sessionExitUrl),
    sessionLandingPath: maybeTrimString(row.sessionLandingPath),
    sessionUtmSourceStart: maybeTrimString(row.sessionUtmSourceStart),
    sessionUtmMediumStart: maybeTrimString(row.sessionUtmMediumStart),
    sessionUtmCampaignStart: maybeTrimString(row.sessionUtmCampaignStart),
    sessionUtmSourceLanding: maybeTrimString(row.sessionUtmSourceLanding),
    sessionUtmMediumLanding: maybeTrimString(row.sessionUtmMediumLanding),
    sessionUtmCampaignLanding: maybeTrimString(row.sessionUtmCampaignLanding),
    sessionUtmTermLanding: maybeTrimString(row.sessionUtmTermLanding),
    sessionUtmContentLanding: maybeTrimString(row.sessionUtmContentLanding),
    sessionRefSource: maybeTrimString(row.sessionRefSource),
    sessionRefMedium: maybeTrimString(row.sessionRefMedium),
    sessionGclid: maybeTrimString(row.sessionGclid),
    sessionDclid: maybeTrimString(row.sessionDclid),
    sessionTrafficSourceType: maybeTrimString(row.sessionTrafficSourceType),
    sessionTrafficSource: maybeTrimString(row.sessionTrafficSource),
    sessionTrafficMedium: maybeTrimString(row.sessionTrafficMedium),
    sessionTrafficCampaign: maybeTrimString(row.sessionTrafficCampaign),
    sessionDeviceCategory: maybeTrimString(row.sessionDeviceCategory),
    sessionOperatingSystem: maybeTrimString(row.sessionOperatingSystem),
    sessionBrowser: maybeTrimString(row.sessionBrowser),
    sessionGeoCountry: maybeTrimString(row.sessionGeoCountry),
    sessionGeoRegion: maybeTrimString(row.sessionGeoRegion),
    sessionGeoCity: maybeTrimString(row.sessionGeoCity),
    sessionTransactionsCount: toNumber(row.sessionTransactionsCount),
    sessionConversionFlag:
      row.sessionConversionFlag === null ||
      row.sessionConversionFlag === undefined
        ? null
        : Boolean(row.sessionConversionFlag),
    sessionHasSessionStart:
      row.sessionHasSessionStart === null ||
      row.sessionHasSessionStart === undefined
        ? null
        : Boolean(row.sessionHasSessionStart),
    sessionUpdatedAt: maybeTrimString(row.sessionUpdatedAt),
    isRefund:
      row.isRefund === null || row.isRefund === undefined
        ? null
        : Boolean(row.isRefund),
    refundAmount: toNumber(row.refundAmount),
    parentTransactionId: maybeTrimString(row.parentTransactionId),
    ingestedAt: maybeTrimString(row.ingestedAt),
  }));
};

export const getPurchaseSessionsByDateRange = async (
  options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    page?: number;
    pageSize?: number;
    truncateStrings?: boolean;
  } = {}
): Promise<PurchaseSessionDetail[]> =>
  fetchPurchaseSessions(DEFAULT_EVENTS_TABLE, options);

export const getDevPurchaseSessionsByDateRange = async (
  options: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    page?: number;
    pageSize?: number;
    truncateStrings?: boolean;
  } = {}
): Promise<PurchaseSessionDetail[]> =>
  fetchPurchaseSessions(DEV_EVENTS_TABLE, options);

export { fetchPurchaseSessions };
