import { ContextType } from 'src/context/Context';
import { MembershipTier } from 'src/modules/membershipTier/Models/MembershipTier';
import { Order, OrderItem, OrderItemWithProduct, ShippingCost } from '../Models/Order';
import { getShippingCost } from './getShippingCost';
import { loadOrderWithProducts } from './loadOrderWithProducts';
import { queryMemberTier } from './queryMemberTier';

export type CalculateTotalArgs = (
  context: ContextType,
  args: { orderId: string; domainId: string; memberId?: string }
) => Promise<{
  total: number;
  subTotal: number;
  memberTotalDiscount: number;
  memberShippingDiscount: number;
  shippingCost: ShippingCost;
}>;

export const calculateTotal: CalculateTotalArgs = (
  ctx,
  { orderId, domainId, memberId }
) => {
  return loadOrderWithProducts(ctx, { _id: orderId }).then(order => {
    return Promise.all([
      getShippingCost(ctx, {
        postcode: order.shipping?.address?.postCode,
        pickup: order.shipping?.pickup || false,
        domainId,
        override: order?.shipping?.shippingCost?.override
          ? order?.shipping?.shippingCost
          : ({} as ShippingCost),
      }),
      queryMemberTier(ctx, { domainId, memberId }),
    ]).then(([shippingCost, memberTier]) => {
      const itemsCostInCents =
        order && order.items.length
          ? order.items.reduce(
              (acc: number, item: OrderItemWithProduct) =>
                acc +
                Number(item.overidedPrice || item.product?.price) * Number(item.quantity),
              0
            )
          : 0;

      const postageCostInCents =
        order?.shipping?.shippingCost?.price || shippingCost?.price || 0;

      if (!shippingCost.allowCheckout) throw new Error(shippingCost.message);

      const amountOfProducts = calcAmountOfProducts(order);

      const memberTotalDiscount = memberTier?.discounts
        ? membersTotalSavings(memberTier, itemsCostInCents, amountOfProducts)
        : 0;

      const memberShippingDiscount = memberTier?.discounts
        ? membersShippingSaving(memberTier, shippingCost, amountOfProducts)
        : 0;

      const itemsWithDiscount =
        Number(itemsCostInCents) - memberTotalDiscount < 0
          ? 0
          : Number(itemsCostInCents) - memberTotalDiscount;
      const postageWithDiscount =
        Number(postageCostInCents) - memberShippingDiscount < 0
          ? 0
          : Number(postageCostInCents) - memberShippingDiscount;

      const total = itemsWithDiscount + postageWithDiscount;

      return {
        total,
        subTotal: itemsCostInCents,
        shippingCost: order?.shipping?.shippingCost || shippingCost,
        memberTotalDiscount,
        memberShippingDiscount,
      };
    });
  });
};

const calcAmountOfProducts = (order: Order) => {
  return (
    order?.items?.reduce(
      (partialSum: number, item: OrderItem) => partialSum + item.quantity,
      0
    ) || 0
  );
};

const membersTotalSavings = (
  tier: MembershipTier,
  subTotal: number,
  amountOfProducts: number
) => {
  const savings = tier?.discounts?.reduce((partialSum, discount) => {
    if (discount.appliedTo === 'shipping') return partialSum + 0;
    if (
      discount.minItemsRequiredForDiscount &&
      discount.minItemsRequiredForDiscount > amountOfProducts
    )
      return partialSum + 0;
    if (discount.type === 'flat') return partialSum + discount.value;
    return partialSum + subTotal * (discount.value / 100);
  }, 0);
  return savings || 0;
};

const membersShippingSaving = (
  tier: MembershipTier,
  shippingCost: ShippingCost,
  amountOfProducts: number
) => {
  if (!tier?.discounts) return 0;

  const _cost = tier?.discounts?.reduce((partialSum, discount) => {
    if (discount.appliedTo === 'total') return partialSum + 0;
    if (
      discount.minItemsRequiredForDiscount &&
      discount.minItemsRequiredForDiscount > amountOfProducts
    )
      return partialSum + 0;
    if (discount?.shipping?.value !== shippingCost.type) return partialSum + 0;
    if (discount.type === 'flat') return partialSum + discount.value;

    return partialSum + Number(shippingCost.price) * (discount.value / 100);
  }, 0);
  return _cost;
};
