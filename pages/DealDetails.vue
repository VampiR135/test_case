<template>
  <component
      :is="gridBlock"
      v-if="deal && !loadingDealData"
  >
    <template v-slot:title>
      <div class="d-flex justify-content-between position-relative">
        <h1 class="h1">{{ isNeedBuyerPayout ? 'Проверьте условия сделки' : 'Сделка ' + deal.id_formatted }}</h1>
        <dotted-menu
            ref="topMenu"
            :requested-by="viewerRole"
            :link-url="linkToDeal"
            :link-to-edit-deal="linkToEditDeal"
            :deal-id="deal['~id']"
            :can-be-copied-link="canBeCopiedLink"
            :can-be-cancelled="canBeCancelled"
            :can-be-deleted="canBeDeleted"
            :can-be-edited-with-deleted="canBeEditedWithDeleted"
            :is-editable="!isDealWithPayout"
            :deal-grants="deal.grants"
            :is-cod-deal="isCodDeal"
            @canceledDeal="setDeal"
            @copiedDeal="copiedDeal"
            @deletedDeal="deletedDeal"
        />
      </div>
    </template>

    <template v-if="isNeedBuyerPayout" v-slot:title_text>
      <p class="mb-2">Внимательно ознакомьтесь с условиями сделки, прежде чем переходить к оплате. Продавец мог изменить условия</p>
      <p class="mb-2 font-weight-bold">
        <a href="javascript:void(0);" @click="scrollToElement('.status_block')">Перейти к оплате</a>
      </p>
      <p v-if="textByReceiveMode && deliveryAddressFull" class="mb-2 font-weight-bold">Посылка будет доставлена {{ textByReceiveMode }}:</p>
      <p v-if="deliveryAddressFull">{{ deliveryAddressFull }}</p>
    </template>

<!--    <template v-slot:stages>-->
<!--      <stages-status :viewerRole="viewerRole"/>-->
<!--    </template>-->

    <template v-if="surchargeCount" v-slot:surcharge>
      <surcharge-block
          :paymentSum="surchargeCount"
      />
    </template>

    <template v-if="isNeedWrap" v-slot:status_block>
      <div>
        <div class="server-message mb-4 alert_m-0" v-if="showSuccessSurchargeMessage">
          <div class="alert__text">
            Доплата была успешно принята
          </div>
        </div>
        <component
            :is="statusBlock"
            v-bind="statusProperties"
            @procedureCall="procedureCall"
            :class="{ 'status_block': isNeedBuyerPayout }"
        />
      </div>
    </template>
    <template v-else v-slot:status_block_unwrapped>
      <div>
        <div class="server-message mb-4 alert_m-0" v-if="showSuccessSurchargeMessage">
          <div class="alert__text">
            Доплата была успешно принята
          </div>
        </div>
        <component
            :is="statusBlock"
            v-bind="statusProperties"
            @procedureCall="procedureCall"
            :class="{ 'status_block': isNeedBuyerPayout }"
        />
      </div>
    </template>

    <template v-if="statusList.length" v-slot:status_list>
      <div class="delimiter delimiter_size-0"></div>
      <template v-for="(item, index) in statusList">
        <div class="content-block__body content-block__body_p-0" :key="'status_' + index">
          <div class="container-fluid">
            <div class="create-deal__accept-info">
              <div class="accept-info__text">{{ item.title }}</div>
              <div class="accept-info__date">{{ formatDate(item.date) }}</div>
            </div>
          </div>
        </div>
        <div
            v-if="index < statusList.length"
            class="delimiter delimiter_size-0"
            :key="'delimiter_' + index"
        ><!-- --></div>
      </template>
    </template>

    <template v-slot:about>
      <about-block :deal="deal" />
    </template>

    <template v-slot:info>
      <calculation-info
          v-if="deal.calculation_result"
          :deal="deal"
          :role="viewerRole"
          :force-name-deal="forceNameDealForCalculationInfo"
      />
    </template>

    <template v-slot:delivery>
      <deal-info-delivery
          :deal="deal"
          :viewer-role="viewerRole"
          :card-number="deal.payout_requisite ? deal.payout_requisite.number : null"
      />
    </template>
  </component>
  <loading-block v-else-if="loadingDealData" />
</template>

<script>

import Vue from 'vue';
import { mapActions, mapState } from 'vuex';
import parseUrl from '@/assets/helpers/parse_url';

import formatDate from '@/assets/helpers/format_datetime';
import { procedureCall } from '@/assets/helpers/procedure_call';
import { checkObjectValue, isObject } from '@/assets/helpers/object_helpers';
import { getField } from '@/assets/helpers/get_field';
import { getAbsoluteUrlByRouteName } from '@/assets/vue-mixins/get_route_path_by_name';

const DraftDealBlock = () => import('@/components/deal_details/status_blocks/DraftDealBlock');
const CheckPayoutBlock = () => import('@/components/deal_details/status_blocks/CheckPayoutBlock');
const ErrorPayoutBlock = () => import('@/components/deal_details/status_blocks/ErrorPayoutBlock');
const WaitingPayoutBlock = () => import('@/components/deal_details/status_blocks/WaitingPayoutBlock');
const WaitingPerformingBlock = () => import('@/components/deal_details/status_blocks/WaitingPerformingBlock');
const EditedDealBlock = () => import('@/components/deal_details/status_blocks/EditedDealBlock');
const ModerationDealBlock = () => import('@/components/deal_details/status_blocks/ModerationDealBlock');
const PerformingDealBlock = () => import('@/components/deal_details/status_blocks/PerformingDealBlock');
const CancellationDealBlock = () => import('@/components/deal_details/status_blocks/CancellationDealBlock');
const CanceledDealBlock = () => import('@/components/deal_details/status_blocks/CanceledDealBlock');
const CompletionDealBlock = () => import('@/components/deal_details/status_blocks/CompletionDealBlock');
const CompletedDealBlock = () => import('@/components/deal_details/status_blocks/CompletedDealBlock');
const RequisiteChangeBlock = () => import('@/components/deal_details/status_blocks/RequisiteChangeBlock');
const SurchargeBlock = () => import('@/components/deal_details/status_blocks/SurchargeBlock');
const TerminalDeletedBlock = () => import('@/components/deal_details/status_blocks/TerminalDeletedBlock');
const CalculationErrorBlock = () => import('@/components/deal_details/status_blocks/CalculationErrorBlock');

const MainGrid = () => import('@/components/deal_details/grid/MainGrid');
const InverseGrid = () => import('@/components/deal_details/grid/InverseGrid');

const LoadingBlock = () => import('@/components/common/LoadingBlock');
const CalculationInfo = () => import('@/components/common/CalculationInfo');
const DottedMenu = () => import('@/components/deal_details/DottedMenuTop');
// const StagesStatus = () => import('@/components/deal_details/invite_block/StagesStatus');
const AboutBlock = () => import('@/components/deal_fillup/calculation_stage_components/AboutBlock');
const DealInfoDelivery = () => import('@/components/common/DealInfoDelivery');

export default {
  name: 'DealDetails',
  metaInfo() {
    return {
      title: `Сделка ${this.$route.params.id} - Сервис.`
    }
  },
  components: {
    DraftDealBlock,
    CheckPayoutBlock,
    ErrorPayoutBlock,
    WaitingPayoutBlock,
    WaitingPerformingBlock,
    EditedDealBlock,
    ModerationDealBlock,
    PerformingDealBlock,
    CancellationDealBlock,
    CanceledDealBlock,
    CompletionDealBlock,
    CompletedDealBlock,
    RequisiteChangeBlock,
    LoadingBlock,
    CalculationInfo,
    DottedMenu,
    SurchargeBlock,
    CalculationErrorBlock,
    // StagesStatus,
    MainGrid,
    InverseGrid,
    AboutBlock,
    DealInfoDelivery,
    TerminalDeletedBlock
  },
  data() {
    return {
      joinToken: null,
      loadingDealData: false,
      showSuccessSurchargeMessage: false
    }
  },
  mixins: [
    procedureCall,
    getAbsoluteUrlByRouteName
  ],
  computed: {
    ...mapState('dealDetails', [
      'deal',
      'viewerRole'
    ]),
    isNeedWrap() {
      // нужно ли выводить блоки обвязки вокруг компонента
      return this.statusBlock !== 'DraftDealBlock';
    },
    statusBlock() {
      if (this.deal) {
        if (this.$route.params.edited_deal) {
          return 'EditedDealBlock';
        }
        if (!this.deal.calculation_result) {
          return 'CalculationErrorBlock';
        }
        if (this.isDealInWork && this.deal.requisite_change_required && this.viewerRole === 'seller') {
          return 'RequisiteChangeBlock';
        }
        if (this.deal.terminal_change_required) {
          return 'TerminalDeletedBlock';
        }
        const blocksList = {
          draft: 'DraftDealBlock',
          moderation: 'ModerationDealBlock',
          deposit_waiting: this.checkStatusPayout() ? this.checkStatusPayout() : 'WaitingPayoutBlock',
          deposit_processing: 'CheckPayoutBlock',
          waiting_performing: 'WaitingPerformingBlock',
          performing: 'PerformingDealBlock',
          cancellation: 'CancellationDealBlock',
          completion: 'CompletionDealBlock',
          canceled: 'CanceledDealBlock',
          completed: 'CompletedDealBlock'
        };
        return this.getField(blocksList, this.deal.status);
      } else {
        return null;
      }
    },
    statusProperties() {
      const propertiesList = {
        CalculationErrorBlock: { deal: this.deal, viewerRole: this.viewerRole },
        DraftDealBlock: { joinLink: this.getAbsoluteUrlByRouteName('DealJoin', { token: this.joinToken }) },
        WaitingPayoutBlock: { address: this.deliveryAddressFull, deliveryText: this.textByReceiveMode, paymentSum: this.getField(this.deal.calculation_result, 'buyer_have_to_pay_online')},
        WaitingPerformingBlock: { address: this.deliveryAddressFull, deliveryText: this.textByReceiveMode },
        ErrorPayoutBlock: { paymentSum: this.getField(this.deal.calculation_result, 'buyer_have_to_pay_online') },
        EditedDealBlock: { paymentSum: this.getField(this.deal.calculation_result, 'buyer_have_to_pay_online') },
        CompletionDealBlock: { cardNumber: this.getField(this.deal.payout_requisite, 'number'), performingTrackList: this.deal.performing_track, trackingId: this.getField(this.deal.delivery, 'dispatch_number') },
        PerformingDealBlock: { deal: this.deal, address: this.deliveryAddressFull, deliveryText: this.textByReceiveMode },
        RequisiteChangeBlock: { cardNumber: this.getField(this.deal.payout_requisite, 'number') }
      };
      return this.getField(propertiesList, this.statusBlock, {});
    },
    canBeCopiedLink() {
      return this.deal.status !== 'draft';
    },
    canBeCancelled() {
      return this.deal.status === 'deposit_waiting';
    },
    canBeDeleted() {
      return this.deal.status === 'draft' || this.deal.status === 'canceled';
    },
    canBeEditedWithDeleted() {
      return this.viewerRole === 'seller' && this.deal.status === 'deposit_waiting';
    },
    isDealWithPayout() {
      return this.deal.status !== 'draft' && this.deal.status !== 'deposit_waiting';
    },
    linkToDeal() {
      return this.getAbsoluteUrlByRouteName('DealDetails', { id: this.deal['~id'] });
    },
    linkToEditDeal() {
      const urlId = this.isCodDeal ? 'CodDealEdit' : 'DealEdit';
      return this.getAbsoluteUrlByRouteName(urlId, { id: this.deal['~id'] });
    },
    statusList() {
      let checkpoints = [];
      // function addCheckpoint(field, text) {
      //   //статус добавляется в начало списка
      //   if(field) {
      //     checkpoints = [{
      //       title: text,
      //       date: field
      //     }, ...checkpoints]
      //   }
      // }
      // addCheckpoint(this.deal.created_at, 'Сделка создана', checkpoints); // добавление статуса сделки (поле с датой, название поля, временный список)
      return checkpoints;
    },
    isDealInWork() {
      const statusList = ['deposit_waiting', 'deposit_processing', 'waiting_performing', 'performing', 'moderation', 'completion'];
      return statusList.indexOf(this.deal.status) >= 0;
    },
    surchargeCount() {
      if(this.viewerRole === 'seller' && this.isStatusWithSurcharge) {
        return this.getField(this.deal.calculation_result, 'seller_have_to_pay_online');
      }
      if(this.viewerRole === 'buyer' && this.isStatusWithSurcharge) {
        return this.getField(this.deal.calculation_result, 'buyer_have_to_pay_online');
      }
      return false;
    },
    isStatusWithSurcharge() {
      return ['waiting_performing', 'performing', 'completion'].indexOf(this.deal.status) !== -1;
    },
    isNeedBuyerPayout() {
      return this.viewerRole === 'buyer'
        && this.deal.status === 'draft'
        && this.deal.seller_profile_id
        && (this.deal.payout_requisite_id || this.deal.payout_sbp_requisite_id)
        && (checkObjectValue(this.deal.receiver_courier_info, ['city', 'street', 'house']) || !!this.deal.pickup_point_id);
    },
    gridBlock() {
      return this.isNeedBuyerPayout ? 'InverseGrid' : 'MainGrid';
    },
    deliveryAddressFull() {
      let address = null;
      if(this.getField(this.deal.tariff, 'receive_mode') === 'door'){
        let deliveryInfo = this.deal.receiver_courier_info;
        if(isObject(deliveryInfo)){
          address = `${deliveryInfo.city}, ${deliveryInfo.street}, ${deliveryInfo.house}, ${deliveryInfo.flat}`;
        }
      }
      if(this.getField(this.deal.tariff, 'receive_mode') === 'terminal'){
        address = this.deal.terminal_address
          ? `${this.deal.receiver_city_name}, ${this.deal.terminal_address}`
          : null;
      }

      return address;
    },
    textByReceiveMode() {
      const receiveMode = this.getField(this.deal.tariff, 'receive_mode');
      let receiveModeText = '';
       if(receiveMode === 'door') {
         receiveModeText = 'курьером до адреса';
       } else if(receiveMode === 'terminal') {
         receiveModeText = 'в пункт выдачи по адресу'
       }
       return receiveModeText;
    },
    forceNameDealForCalculationInfo() {
      return this.isCodDeal ? 'сделку с наложенным платежом' : null;
    },
    isCodDeal() {
      return this.getField(this.deal, 'extra_type') === 'cod';
    }
  },
  created: async function() {
    if(this.$route.params.edit_success) {
      this.showModal('modalSuccess', {
        title: 'Сделка успешно сохранена',
        text: ['Данные сделки успешно сохранены.']
      });
    }
    await this.getDeal();
    const parsedUrl = parseUrl(window.location.href);
    const urlQuery = parsedUrl.searchObject;
    if (urlQuery && urlQuery['success_surcharge'] && !this.surchargeCount) {
      this.showSuccessSurchargeMessage = true;
      window.history.replaceState({}, document.title, window.location.href.replace(parsedUrl.search, ''));
    }
  },
  methods: {
    ...mapActions('dealDetails', [
      'setDeal',
      'setViewerRole'
    ]),
    getDeal() {
      this.loadingDealData = true;
      Vue.axios.get(this.getPathRequest('deal_info', {id: this.$route.params.id}))
        .then(response => {
          const respDeal = response.data.deal;
          this.joinToken = response.data.join_token;
          if(respDeal.status !== 'draft' && ((!respDeal.seller_profile_id || !respDeal.buyer_profile_id) && respDeal.extra_type !== 'cod')) {
            this.$router.push({name: 'DealJoin', params: {token: this.joinToken.toString()}});
          } else {
            this.setDeal(respDeal);
            this.setViewerRole(response.data.requested_by);
          }
        })
        .catch(error => {
          this.$router.push({
            name: 'CustomErrorBlock',
            params: {
              title: 'Ошибка получения сделки',
              text: error.response.data.message
                ? error.response.data.message
                : 'Не удалось получить сделку. Пожалуйста, попробуйте снова или обратитесь к нам в тех. поддержку.'
            }
          });
        })
        .finally(() => {
          this.loadingDealData = false;
        });
    },
    checkStatusPayout() {
      if(this.$route.query.failed_payout) {
        return 'ErrorPayoutBlock';
      } else if (this.$route.query.success_payout) {
        return 'CheckPayoutBlock';
      } else {
        return false;
      }
    },
    copiedDeal(payload) {
      this.$router.push({name: 'DealList', params: { copied_deal: 'true', id: payload['~id'], originDealId: this.deal['~id'] }});
    },
    deleteDeal() {
      this.$refs.topMenu.deleteDeal();
    },
    deletedDeal() {
      this.$router.push({name: 'DealList', params: { deleted_deal: 'true', id: this.deal['~id']}});
    },
    formatDate,
    getField
  }
}
</script>
