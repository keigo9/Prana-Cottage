import {Dispatch, SetStateAction, Suspense, useEffect, useState} from 'react';
import {defer, redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  Await,
  Link,
  useLoaderData,
  type MetaFunction,
  type FetcherWithComponents,
  useLocation,
  useSearchParams,
} from '@remix-run/react';
import type {
  ProductFragment,
  ProductVariantsQuery,
  ProductVariantFragment,
} from 'storefrontapi.generated';
import {
  Image,
  Money,
  VariantSelector,
  type VariantOption,
  getSelectedProductOptions,
  CartForm,
} from '@shopify/hydrogen';
import type {
  CartLineInput,
  SelectedOption,
} from '@shopify/hydrogen/storefront-api-types';
import {getVariantUrl} from '~/lib/variants';
import {
  CaptionProps,
  DateFormatter,
  DateRange,
  DayPicker,
  IconLeft,
  IconRight,
  useNavigation,
} from 'react-day-picker';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isSameMonth,
} from 'date-fns';
import 'react-day-picker/dist/style.css';
import {ja} from 'date-fns/locale';
import {getEvents} from '~/.server/googleCal';

export const meta: MetaFunction<typeof loader> = ({data, location}) => {
  return [{title: `Hydrogen | ${data?.product.title ?? ''}`}];
};

export async function loader({params, request, context}: LoaderFunctionArgs) {
  const {handle} = params;
  const {storefront} = context;

  const selectedOptions = getSelectedProductOptions(request).filter(
    (option) =>
      // Filter out Shopify predictive search query params
      !option.name.startsWith('_sid') &&
      !option.name.startsWith('_pos') &&
      !option.name.startsWith('_psq') &&
      !option.name.startsWith('_ss') &&
      !option.name.startsWith('_v') &&
      // Filter out third party tracking params
      !option.name.startsWith('fbclid'),
  );

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  // await the query for the critical product data
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle, selectedOptions},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  const firstVariant = product.variants.nodes[0];
  const firstVariantIsDefault = Boolean(
    firstVariant.selectedOptions.find(
      (option: SelectedOption) =>
        option.name === 'Title' && option.value === 'Default Title',
    ),
  );

  if (firstVariantIsDefault) {
    product.selectedVariant = firstVariant;
  } else {
    // if no selected variant was returned from the selected options,
    // we redirect to the first variant's url with it's selected options applied
    if (!product.selectedVariant) {
      throw redirectToFirstVariant({product, request});
    }
  }

  // In order to show which variants are available in the UI, we need to query
  // all of them. But there might be a *lot*, so instead separate the variants
  // into it's own separate query that is deferred. So there's a brief moment
  // where variant options might show as available when they're not, but after
  // this deffered query resolves, the UI will update.
  const variants = storefront.query(VARIANTS_QUERY, {
    variables: {handle},
  });

  getEvents(context.env.GOOGLE_PROJECT_NUMBER, context.env.GOOGLE_CALENDAR_ID);

  return defer({product, variants});
}

function redirectToFirstVariant({
  product,
  request,
}: {
  product: ProductFragment;
  request: Request;
}) {
  const url = new URL(request.url);
  const firstVariant = product.variants.nodes[0];

  return redirect(
    getVariantUrl({
      pathname: url.pathname,
      handle: product.handle,
      selectedOptions: firstVariant.selectedOptions,
      searchParams: new URLSearchParams(url.search),
    }),
    {
      status: 302,
    },
  );
}

export default function Product() {
  const {product, variants} = useLoaderData<typeof loader>();
  const {selectedVariant} = product;
  return (
    <div className="product">
      <ProductImage image={selectedVariant?.image} />
      <ProductMain
        selectedVariant={selectedVariant}
        product={product}
        variants={variants}
      />
    </div>
  );
}

function ProductImage({image}: {image: ProductVariantFragment['image']}) {
  if (!image) {
    return <div className="product-image" />;
  }
  return (
    <div className="product-image">
      <Image
        alt={image.altText || 'Product Image'}
        aspectRatio="1/1"
        data={image}
        key={image.id}
        sizes="(min-width: 45em) 50vw, 100vw"
      />
    </div>
  );
}

function ProductMain({
  selectedVariant,
  product,
  variants,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedVariant'];
  variants: Promise<ProductVariantsQuery>;
}) {
  const {title, descriptionHtml} = product;
  return (
    <div className="product-main">
      <h1>{title}</h1>
      <ProductPrice selectedVariant={selectedVariant} />
      <br />
      <Suspense
        fallback={
          <ProductForm
            product={product}
            selectedVariant={selectedVariant}
            variants={[]}
          />
        }
      >
        <Await
          errorElement="There was a problem loading product variants"
          resolve={variants}
        >
          {(data) => (
            <ProductForm
              product={product}
              selectedVariant={selectedVariant}
              variants={data.product?.variants.nodes || []}
            />
          )}
        </Await>
      </Suspense>
      <br />
      <br />
      <p>
        <strong>Description</strong>
      </p>
      <br />
      <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
      <br />
    </div>
  );
}

function ProductPrice({
  selectedVariant,
}: {
  selectedVariant: ProductFragment['selectedVariant'];
}) {
  return (
    <div className="product-price">
      {selectedVariant?.compareAtPrice ? (
        <>
          <p>Sale</p>
          <br />
          <div className="product-price-on-sale">
            {selectedVariant ? <Money data={selectedVariant.price} /> : null}
            <s>
              <Money data={selectedVariant.compareAtPrice} />
            </s>
          </div>
        </>
      ) : (
        selectedVariant?.price && <Money data={selectedVariant?.price} />
      )}
    </div>
  );
}

function ProductForm({
  product,
  selectedVariant,
  variants,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment['selectedVariant'];
  variants: Array<ProductVariantFragment>;
}) {
  const [range, setRange] = useState<DateRange | undefined>();
  const [isSelectedDays, setIsSelectedDays] = useState(false);
  return (
    <div className="product-form">
      <VariantSelector
        handle={product.handle}
        options={product.options}
        variants={variants}
      >
        {({option}) =>
          option.name !== 'Duration' && (
            <ProductOptions key={option.name} option={option} />
          )
        }
      </VariantSelector>
      <br />
      <DatePicker
        range={range}
        setRange={setRange}
        setIsSelectedDays={setIsSelectedDays}
      />
      <br />
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        onClick={() => {
          window.location.href =
            window.location.href +
              window.location.href[window.location.href.length - 1] ===
            '#'
              ? 'cart-aside'
              : '#cart-aside';
        }}
        lines={
          selectedVariant
            ? [
                range?.from && range?.to
                  ? {
                      merchandiseId: selectedVariant.id,
                      quantity: 1,
                      attributes: [
                        {
                          key: 'チェックイン',
                          value: format(range.from, 'yyyy/MM/dd'),
                        },
                        {
                          key: 'チェックアウト',
                          value: format(range.to, 'yyyy/MM/dd'),
                        },
                      ],
                    }
                  : {
                      merchandiseId: selectedVariant.id,
                      quantity: 1,
                    },
              ]
            : []
        }
        isSelectedDays={isSelectedDays}
      >
        {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}

function ProductOptions({option}: {option: VariantOption}) {
  return (
    <div className="product-options" key={option.name}>
      <h5>{option.name}</h5>
      <div className="product-options-grid">
        {option.values.map(({value, isAvailable, isActive, to}) => {
          return (
            <Link
              className="product-options-item"
              key={option.name + value}
              prefetch="intent"
              preventScrollReset
              replace
              to={to}
              style={{
                border: isActive ? '1px solid black' : '1px solid transparent',
                opacity: isAvailable ? 1 : 0.3,
              }}
            >
              {value}
            </Link>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  isSelectedDays,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: CartLineInput[];
  onClick?: () => void;
  isSelectedDays?: boolean;
}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <button
            type="submit"
            onClick={onClick}
            disabled={(!isSelectedDays || disabled) ?? fetcher.state !== 'idle'}
          >
            {children}
          </button>
        </>
      )}
    </CartForm>
  );
}

function DatePicker({
  range,
  setRange,
  setIsSelectedDays,
}: {
  range: DateRange | undefined;
  setRange: Dispatch<SetStateAction<DateRange | undefined>>;
  setIsSelectedDays: Dispatch<SetStateAction<boolean>>;
}) {
  const locale = ja;
  const today = new Date();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectAbleStartDate = addDays(today, 2);
  const maxDate = addDays(today, 120);

  const handleResetClick = () => setRange(undefined);
  const [month, setMonth] = useState<Date>(today);

  const resetButton = (
    <button
      onClick={handleResetClick}
      style={{border: '1px solid'}}
      className="rdp-button px-1"
    >
      Reset
    </button>
  );
  const todayButton = (
    <button
      disabled={isSameMonth(today, month)}
      onClick={() => setMonth(today)}
      style={{border: '1px solid'}}
      className="rdp-button px-1"
    >
      今日
    </button>
  );

  const seasonEmoji: Record<string, string> = {
    winter: '⛄️',
    spring: '🌸',
    summer: '🌻',
    autumn: '🍂',
  };
  const getSeason = (month: Date): string => {
    const monthNumber = month.getMonth();
    if (monthNumber >= 0 && monthNumber < 3) return 'winter';
    if (monthNumber >= 3 && monthNumber < 6) return 'spring';
    if (monthNumber >= 6 && monthNumber < 9) return 'summer';
    else return 'autumn';
  };
  const formatCaption: DateFormatter = (date, options) => {
    const season = getSeason(date);
    return (
      <div className="rdp-caption_label gap-2">
        <span role="img" aria-label={season}>
          {seasonEmoji[season]}
        </span>{' '}
        {format(date, 'LLLL', {locale: options?.locale})}
        {format(date, 'yyyy', {locale: options?.locale})}
      </div>
    );
  };

  function CustomCaption(props: CaptionProps) {
    const {goToMonth, nextMonth, previousMonth} = useNavigation();
    return (
      <div className="rdp-caption">
        {formatCaption(props.displayMonth, {locale})}
        <div className="rdp-nav flex">
          <button
            disabled={!previousMonth}
            onClick={() => previousMonth && goToMonth(previousMonth)}
            className="rdp-button_reset rdp-button rdp-nav_button rdp-nav_button_previous w-30"
            style={{width: '30px', height: '30px'}}
          >
            <IconLeft className="rdp-nav_icon" />
          </button>
          <button
            disabled={!nextMonth}
            onClick={() => nextMonth && goToMonth(nextMonth)}
            className="rdp-button_reset rdp-button rdp-nav_button rdp-nav_button_next"
            style={{width: '30px', height: '30px'}}
          >
            <IconRight className="rdp-nav_icon" />
          </button>
          {todayButton}
        </div>
      </div>
    );
  }

  const disabledDays = [
    new Date(2022, 5, 10),
    new Date(2022, 5, 12),
    new Date(2022, 5, 20),
  ];

  let footer = <p>日付を選択してください</p>;
  if (range?.from) {
    if (!range.to) {
      footer = (
        <div>
          <p>チェックイン: {format(range.from, 'PPP', {locale})}</p>
          {resetButton}
        </div>
      );
    } else if (range.to) {
      const stayDaysNight = differenceInCalendarDays(range.to, range.from);
      footer = (
        <div>
          <p>
            チェックイン: {format(range.from, 'PPP', {locale})}
            <br />
            チェックアウト: {format(range.to, 'PPP', {locale})}
            <br />
            宿泊日数: {stayDaysNight}日
          </p>
          {resetButton}
        </div>
      );
    }
  }

  useEffect(() => {
    setIsSelectedDays(false);
    let stayDaysNight = 1;
    if (range?.from && range?.to) {
      stayDaysNight = differenceInCalendarDays(range.to, range.from);
      setIsSelectedDays(true);
    }
    const params = new URLSearchParams(location.search);
    params.set('Duration', `${stayDaysNight}Day`);
    setSearchParams(params);
  }, [range?.to, range?.from]);

  return (
    <DayPicker
      id="bookingDatePicker"
      mode="range"
      selected={range}
      onSelect={setRange}
      max={8}
      toDate={maxDate}
      showOutsideDays
      month={month}
      onMonthChange={setMonth}
      fromDate={selectAbleStartDate}
      disabled={disabledDays}
      footer={footer}
      components={{
        Caption: CustomCaption,
      }}
      locale={locale}
    />
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    options {
      name
      values
    }
    selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    variants(first: 1) {
      nodes {
        ...ProductVariant
      }
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const PRODUCT_VARIANTS_FRAGMENT = `#graphql
  fragment ProductVariants on Product {
    variants(first: 250) {
      nodes {
        ...ProductVariant
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const VARIANTS_QUERY = `#graphql
  ${PRODUCT_VARIANTS_FRAGMENT}
  query ProductVariants(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...ProductVariants
    }
  }
` as const;
