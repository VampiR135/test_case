<template>
  <div>
    <template v-if="deal">
      <div class="background" v-if="stage === 'verification'">
        <div class="background__wrapper">
          <div class="background__circle background__circle_small"></div>
          <div class="background__circle background__circle_medium"></div>
        </div>
      </div>

      <div class="container-outer container-outer_pt-60 container-outer_width-720">
        <verification-block
            v-if="stage === 'verification'"
            :deal="deal"
        />
        <template v-if="viewerRole === 'buyer'">
          <confirmation-block
              v-if="stage === 'confirmation'"
              ref="confirmationBlock"
              @goNextStage="setStage({name:'choice_payment_method'})"
          />
          <choice-payment-method-block
              v-else-if="stage === 'choice_payment_method'"
              ref="choicePaymentMethodBlock"
              :payment-method-list="paymentMethodList"
              @procedureCall="procedureCall"
          />
          <delivery-pec :name-modal="'deliveryPecJoin'" :is-customer="true" @closeModal="menuEvent" />

          <div class="save-changes">
            <div class="container-outer container-outer_width-720">
              <div class="save-changes__body">
                <a
                    href="javascript:void(0);"
                    class="save-changes__clear"
                    :class="{ 'save-changes__hidden': stage === 'verification' }"
                    data-test="backStage"
                    @click="menuCancel()"
                >
                  <svg class="icon icon-clear">
                    <use xlink:href="#icon-clear"></use>
                  </svg>
                  <span>
                  {{ menuTextCancel }}
                </span>
                </a>
                <loader v-if="joinLoader" />
                <a
                    href="javascript:void(0);"
                    @click="checkMenuEvent"
                    class="button button_size-64 button_no-shadow button_no-transform save-changes__button"
                    :class="{ 'button_disabled': joinLoader }"
                    data-test="nextStage"
                    v-html="menuTextNext"
                ></a>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>

    <template v-if="loadingDealData">
      <loading-block />
    </template>
  </div>
</template>

<script>
import Vue from 'vue';
import { mapActions, mapState } from 'vuex';
import VerificationBlock from '@/components/deal_join/VerificationBlock';
import ConfirmationBlock from '@/components/deal_join/ConfirmationBlock';
import ChoicePaymentMethodBlock from '@/components/deal_join/ChoicePaymentMethodBlock.vue';
import LoadingBlock from '@/components/common/LoadingBlock';
import Loader from '@/components/common/Loader';
import DeliveryPec from '@/components/modals/DeliveryPec';
import { getField } from '@/assets/helpers/get_field';
import { formatMoney } from '@/assets/helpers/format_money';
import { comparisonObjects } from '@/assets/helpers/object_helpers';
import { getAbsoluteUrlByRouteName } from '@/assets/vue-mixins/get_route_path_by_name';
import { createPaymentForm } from '@/assets/helpers/create_payment_form';
import { procedureCall } from '@/assets/helpers/procedure_call';

export default {
  name: 'DealJoin',
  metaInfo() {
    return {
      title: `Присоединение к сделке ${this.$route.params.token} - Сервис.`
    }
  },
  mixins: [getAbsoluteUrlByRouteName, procedureCall],
  components: {
    VerificationBlock,
    ConfirmationBlock,
    ChoicePaymentMethodBlock,
    LoadingBlock,
    Loader,
    DeliveryPec
  },
  data() {
    return {
      stage: 'verification',
      loadingDealData: false,
      joinLoader: false
    }
  },
  computed: {
    ...mapState([
      'isAuthorized',
      'user'
    ]),
    ...mapState('dealJoin', [
      'deal',
      'deliveryPoint',
      'viewerRole',
      'deliveryData'
    ]),
    menuTextNext() {
      if(this.stage === 'choice_payment_method') {
        return 'Оплатить';
      } else {
        return 'Продолжить';
      }
    },
    menuTextCancel() {
      switch (this.stage) {
        case 'verification':
          return 'Отменить';
        case 'confirmation':
        case 'choice_payment_method':
          return 'Назад';
        default:
          return 'Отменить';
      }
    },
    isSelfDelivery() {
      return this.getField(this.deal, 'tariff_id').includes('self-') || this.getField(this.deal.tariff, 'tariff_id').includes('self-');
    },
    paymentMethodList() {
      const list = [
        {
          type: 'card',
          text: 'банковской картой',
          cost: this.getField(this.deal.calculation_result, 'buyer_expenses')
        }
      ];
      const sbpPayment = this.getField(this.deal.sbp_calculation_result, 'buyer_expenses');
      if(sbpPayment) {
        list.push({
          type: 'sbp',
          text: 'через СПБ по QR коду',
          cost: sbpPayment
        })
      }
      return list;
    }
  },
  created() {
    this.getDeal();
  },
  mounted() {
    this.$root.$on('authorizationSuccessAction', (data) => {
      if(data.action === 'join_deal') {
        this.menuEvent();
      }
    });
  },
  methods: {
    ...mapActions('dealJoin', [
      'setDeal',
      'setViewerRole'
    ]),
    checkMenuEvent () {
      if(this.getField(this.deal, 'delivery_company') === 'pec' && this.stage === 'verification') {
        this.showModal('deliveryPecJoin');
      } else {
        this.menuEvent();
      }
    },
    menuEvent() {
      if(this.stage === 'choice_payment_method') {
        this.$refs.choicePaymentMethodBlock.nextStageClicked();
      } else if(this.stage === 'confirmation') {
        this.$refs.confirmationBlock.nextStageClicked();
      } else if(this.stage === 'verification') {
        if(!this.isAuthorized) {
          this.$nextTick(() => {
            this.showModal('loginFrame', { action: 'join_deal' });
          });
        } else if(this.isSelfDelivery) {
          this.setStage({name:'choice_payment_method'});
        } else {
          this.setStage({name:'confirmation'});
        }
      }
    },
    menuCancel() {
      if(this.stage === 'confirmation') {
        this.setStage({name:'verification'});
      } else if(this.stage === 'choice_payment_method') {
        if(this.isSelfDelivery) {
          this.setStage({name:'verification'});
        }  else {
          this.setStage({name:'confirmation'});
        }
      }
    },
    dealConfirm(data) {
      if(this.joinLoader === true){
        return;
      }
      this.joinLoader = true;
      let dataRequest = {
        first_name: this.user.firstName,
        middle_name: this.user.middleName,
        last_name: this.user.lastName,
        email: this.user.email,
        phone: this.user.phone.toString().replace(/[^\d]/g, ''),
        success_url: this.getAbsoluteUrlByRouteName('DealDetails', { id: this.deal['~id'] }) + '?success_payout=true',
        fail_url: this.getAbsoluteUrlByRouteName('DealDetails', { id: this.deal['~id'] }) + '?failed_payout=true'
      };
      if(this.deliveryData) dataRequest = {...dataRequest, ...this.deliveryData};
      if(this.deliveryPoint) dataRequest = {...dataRequest, point: this.deliveryPoint.id};
      if(data.payment_type) dataRequest = {...dataRequest, payment_type: data.payment_type};
      Vue.axios.post(
        this.getPathRequest('deal_join', {token: this.$route.params.token}),
        {
          ...dataRequest
        }
      )
        .then(response => {
          const checkFieldsList = [
            '~id',
            'conditions',
            'attachments',
            'calculation_result',
            'commission_payer',
            'delivery_payer',
            'packages',
            'sender_city_name',
            'sender_city_id',
            'receiver_city_name',
            'receiver_city_id',
            'tariff'
          ];
          if(this.viewerRole === 'seller') {
            checkFieldsList.push('buyer_contacts');
          } else if(this.viewerRole === 'buyer') {
            checkFieldsList.push('seller_contacts');
          }
          comparisonObjects(response.data.deal, this.deal, checkFieldsList)
            .then(() => {
              this.sendMetricEvent('deals_btm_join');
              if(response.data.form_data) {
                createPaymentForm(response.data.form_data);
              } else {
                this.$router.push({name: 'DealDetails', params: {id: this.deal['~id']}});
              }
            })
            .catch(() => {
              this.showModal('modalFailed', {
                title: 'Продавец изменил условия сделки.',
                text: ['Обязательно ознакомьтесь с&#160;новыми условиями. Сообщите продавцу, если они вас не&#160;устраивают.',
                  'Если новые условия сделки вам подходят, то вы можете перейти к&#160;оплате.']
              });
              this.getDeal();
            })
            .finally(() => {
              this.joinLoader = false;
            });
        })
        .catch(error => {
          this.showModal('modalFailed', {
            title: 'Ошибка присоединения к сделке',
            text: error.response.data.message
              ? [error.response.data.message]
              : ['Не удалось присоединиться к сделке. Пожалуйста, попробуйте снова или обратитесь к нам в тех. поддержку.']
          });
          this.joinLoader = false;
        });
    },
    getDeal() {
      this.loadingDealData = true;

      Vue.axios.get(this.getPathRequest('deal_join', {token: this.$route.params.token}))
        .then(response => {
          if(response.data.deal.deal_id || response.data.deal.status !== 'draft') {
            this.$router.push({name: 'DealDetails', params: {id: response.data.deal['~id']}});
            this.loadingDealData = false;
          } else {
            this.setDeal(response.data.deal);
            this.setViewerRole(response.data.requested_by);
            this.loadingDealData = false;
          }
        })
        .catch(error => {
          this.loadingDealData = false;
          this.$router.push({
            name: 'CustomErrorBlock',
            params: {
              title: 'Ошибка получения сделки',
              text: error.response.data.message
                ? error.response.data.message
                : 'Не удалось получить сделку. Пожалуйста, попробуйте снова или обратитесь к нам в тех. поддержку.'
            }
          });
          this.$router.push({ name: '404'});
        });
    },
    setStage(data) {
      this.stage = data.name;
    },
    formatMoney,
    getField
  }
}
</script>
