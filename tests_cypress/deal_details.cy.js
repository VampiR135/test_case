const dealId = 1234567890
let requisiteId = null
import deliveryCompanyList from '../../src/assets/data/delivery_company_list.js'
import getOfficesLink from '../../src/assets/data/delivery_offices_links_list.js'
import formatDate from '../../src/assets/helpers/format_datetime.js'

function checkRenderingBasePage() {
  cy.fixture('common/autologinCreate.html').then((file) => {
    cy.intercept('GET', `${Cypress.env('backUrl')}/autologin**`, file).as('autologin')
  })
  cy.intercept('GET', `*/sockjs-node/info**`, {})
  cy.intercept('GET', `*/api/warning-domain**`, [])
  cy.intercept('GET', `${Cypress.env('globalMessagesUrl')}**`, { fixture: 'common/globalMessages.json' })
}
function waybillDateFormat(value) {
  const DateTimeFormater = new Intl.DateTimeFormat('ru', {
    hour: '2-digit',
    minute: 'numeric',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
  return DateTimeFormater.format(new Date(value))
}
function draftCourierDateFormat(value) {
  const DateTimeFormater = new Intl.DateTimeFormat('ru', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
  return DateTimeFormater.format(new Date(value))
}
function getDeliveryCompany(companyId) {
  return deliveryCompanyList.find(item => item.id === companyId)
}
function checkAdditionalInfoLink(side) {
  cy.get('[href*="https://help.test.ru"]').each(($el) => {
    cy.wrap($el).invoke('attr', 'href').should('include', `for-${side}s`)
  })
}
function checkPerformingTrack(performingTrack) {
  performingTrack.forEach(item => {
    cy.get('.tracking__list').contains('.tracking__item', `${item.title}${item.city_name ? ' (' + item.city_name + ')' : ''} ${item.occurred_at}`)
  })
}
function getOffsetDate(date, offset) {
  let lastDay = new Date(date);
  lastDay.setDate(lastDay.getDate() + offset);
  return formatDate(lastDay).split(',')[0];
}

describe('Open Deal Requisite Block', () => {
  it('Render page', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/draft.json' }).as('getDealDraft')
    cy.intercept('GET', `${Cypress.env('backUrl')}/requisites-selector/list`, { fixture: 'deal_details/requisitesListEmpty.json' })

    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealDraft']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('seller')
      expect(response.body.deal.status).to.equal('draft')
      expect(response.body.deal.payout_requisite).to.equal(null)
      expect(response.body.deal.payout_requisite_id).to.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Черновик успешно создан`)

      // Check deal menu
      cy.get('.dotted-menu').as('dealMenu')
      cy.get('@dealMenu').find('.dotted-menu__toggler').click()
      const dealId = response.body.deal['~id']
      const editUrl = `${Cypress.env('frontUrl')}/deals/${dealId}/edit`
      cy.get('@dealMenu').contains('Дублировать').not('have.class', 'dotted-menu__item_disabled')
      cy.get('@dealMenu').contains('Редактировать').not('have.class', 'dotted-menu__item_disabled').should('have.attr', 'href', editUrl)
      cy.get('@dealMenu').contains('Удалить').not('have.class', 'dotted-menu__item_disabled')

      // Check seller contacts
      cy.get('[data-test=deliveryInfo]').as('deliveryBlock')
      const fullSellerName = `${response.body.deal.seller_contacts.first_name} ${response.body.deal.seller_contacts.middle_name} ${response.body.deal.seller_contacts.last_name}`
      cy.get('@deliveryBlock').find('[data-test=senderCity]').invoke('text').should('eq', response.body.deal.sender_city_name)
      cy.get('@deliveryBlock').find('[data-test=sellerName]').invoke('text').should('eq', fullSellerName)
      cy.get('@deliveryBlock').find('[data-test=sellerPhone]').invoke('text').should('eq', response.body.deal.seller_contacts.phone)
      cy.get('@deliveryBlock').find('[data-test=receiverCity]').invoke('text').should('eq', response.body.deal.receiver_city_name)
    })
  })
  it('Check notifications', () => {
    cy.contains('.server-message', 'Тестовое сообщение для публичных страниц.')
    cy.contains('.server-message', 'Тестовое сообщение для приватных страниц.')
  })
  it('Check New Requisite', () => {
    cy.intercept('GET', `${Cypress.env('backUrl')}/requisites-selector/list`, { fixture: 'deal_details/requisitesList.json' })
    cy.intercept('POST', `${Cypress.env('backUrl')}/requisites-selector/new-form`, { fixture: 'deal_details/requisitesNew.json' }).as('getNewRequisite')

    const paidFormUrl = 'http://example.b2p.com'
    cy.intercept('GET', paidFormUrl, {})
    cy.get('[data-test=requisitesListEmpty]').click()
    cy.wait(['@getNewRequisite']).then(({ response }) => {
      requisiteId = response.body.id
      expect(response.body.url).to.eq(paidFormUrl)
    })
  })
  it('Check Waiting Requisite', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/draft.json' })
    cy.intercept('GET', `${Cypress.env('backUrl')}/requisites-selector/list`, { fixture: 'deal_details/requisitesListEmpty.json' }).as('getEmptyRequisites')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}?waiting_payment=1`)

    cy.get('.alert').contains('Выполняется добавление новой карты, пожалуйста подождите')

    cy.wait(['@getEmptyRequisites']).then(() => {
      cy.intercept('GET', `${Cypress.env('backUrl')}/requisites-selector/list`, {fixture: 'deal_details/requisitesList.json'}).as('getRequisites')
      cy.wait(['@getRequisites']).then(({response}) => {
        expect(response.body[0].id).to.eq(requisiteId)
      })
    })
  })
  it('Check Send Requisite', () => {
    cy.intercept('POST', `${Cypress.env('backUrl')}/deals-payout-setup/${dealId}`, { fixture: 'deal_details/requisitesList.json' }).as('setRequisite')

    cy.get('[data-test=applyRequisite]').click()

    cy.wait(['@setRequisite']).then(({ response }) => {
      expect(response.body[0].id).to.eq(requisiteId)
    })
  })
})

describe('Open Deal Invite Block', () => {
  let inviteToken = ''

  it('Render page', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/draftRequisite.json' }).as('getDealDraft')

    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealDraft']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.deal.payout_requisite).to.not.equal(null)
      expect(response.body.deal.payout_requisite_id).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Пригласите покупателя`)

      cy.get('[data-test=deliveryInfo]').find('[data-test=sellerCard]').invoke('text').should('include', response.body.deal.payout_requisite.number)
      inviteToken = response.body.join_token
    })
  })
  it('Check link invite', () => {
    cy.contains('Или пригласите по ссылке').click()
    cy.get('.alert').contains('Приглашения по ссылкам небезопасный способ')
    cy.get('.share-link').as('shareLink')
    cy.get('@shareLink').contains('Поделиться ссылкой')
    const cutFrontUrl = Cypress.env('frontUrl').split('//')[1]
    cy.get('@shareLink').contains(`${cutFrontUrl}/join/${inviteToken}`)
  })
  it('Check phone invite', () => {
    const invitePhoneNumber = '8005553535'
    cy.get('a.tabs__link').contains('По телефону').click()
    cy.contains('Телефон покупателя')
    cy.get('[data-test=phoneInvite]').type(invitePhoneNumber)
    cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/invite`, {}).as('inviteSendEvent')

    cy.get('[data-test=phoneInviteButton]').click()
    cy.wait(['@inviteSendEvent']).then(() => {
      cy.contains('Приглашение отправлено на телефон')
      cy.contains(invitePhoneNumber)
    })
    cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/withdraw-invitation`, {}).as('inviteCancelEvent')

    cy.get('.share-link__button-cancel').contains('Отменить приглашение').click()
    cy.wait(['@inviteCancelEvent']).then(() => {
      cy.contains('Телефон покупателя')
    })
  })
  it('Check e-mail invite', () => {
    const inviteEmail = 'test@test.ru'
    cy.get('a.tabs__link').contains('По почте').click()
    cy.contains('Электронная почта')
    cy.get('[data-test=emailInvite]').type(inviteEmail)
    cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/invite`, {}).as('inviteSendEvent')

    cy.get('[data-test=emailInviteButton]').click()
    cy.wait(['@inviteSendEvent']).then(() => {
      cy.contains('Приглашение отправлено на почту')
      cy.contains(inviteEmail)
    })
    cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/withdraw-invitation`, {}).as('inviteCancelEvent')

    cy.get('.share-link__button-cancel').contains('Отменить приглашение').click()
    cy.wait(['@inviteCancelEvent']).then(() => {
      cy.contains('Электронная почта')
    })
  })
})

describe('Open Deal Deposit-Waiting Block', () => {
  it('Render page for Buyer Terminal', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/depositWaitingBuyerTerminal.json' }).as('getDealDepositWaiting')

    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealDepositWaiting']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('buyer')
      expect(response.body.deal.status).to.equal('deposit_waiting')
      expect(response.body.deal.payout_requisite).to.not.equal(null)
      expect(response.body.deal.payout_requisite_id).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Оплатите сделку`)

      cy.contains('Посылка будет доставлена в пункт выдачи по адресу:')
      cy.contains(`${response.body.deal.receiver_city_name}, ${response.body.deal.terminal_address}`)

      cy.intercept('GET', `${Cypress.env('backUrl')}/terminal-picker/list**`, { fixture: 'common/terminalsList.json' }).as('getTerminalsList')
      cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/confirm-pickup-point`, { fixture: 'deal_details/confirmPickupPoint.json' })
      cy.get('[data-test=switchTerminalOpen]').click()
      cy.get('[data-test=switchTerminalsBlock]').should('exist')
      cy.contains('h4', 'Выберите подходящий вам пункт доставки.')
      cy.wait(['@getTerminalsList']).then(({ response }) => {
        expect(response.statusCode).to.eq(200)
        expect(response.body.terminals.length).to.not.equal(0)
      })
      cy.get('[data-test=switchTerminalClose]').click()
      cy.get('[data-test=switchTerminalsBlock]').should('not.exist')
      cy.get('[data-test=switchTerminalOpen]').click()
      cy.get('[data-test=switchTerminalSend]').click()
      cy.get('.error_message').should('exist')
      cy.get('[data-test=terminalsList]').find('a').not('.map__search-link--disabled').first().click()
      cy.get('[data-test=switchTerminalSend]').click()

      cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}/payment-form?**`, { fixture: 'common/paymentForm.json' }).as('getPaymentForm')
      const paidFormUrl = 'http://example.b2p.com'
      cy.intercept('POST', paidFormUrl, {})
      cy.get('[data-test=waitingPayoutButton]').click()
      cy.wait(['@getPaymentForm']).then(({ response }) => {
        expect(response.body.form_data.url).to.eq(paidFormUrl)
      })
    })
  })
  it('Render page for Buyer Door', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, {fixture: 'deal_details/depositWaitingBuyerDoor.json'}).as('getDealDepositWaiting')

    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)
    cy.wait(['@getDealDepositWaiting']).then(({ response }) => {
      cy.contains('Посылка будет доставлена курьером до адреса:')
      cy.contains(`${response.body.deal.receiver_courier_info.city}, ${response.body.deal.receiver_courier_info.street}, ${response.body.deal.receiver_courier_info.house}, ${response.body.deal.receiver_courier_info.flat}`)
    })
  })
  it('Render page for Seller', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/depositWaitingSeller.json' }).as('getDealDepositWaiting')

    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealDepositWaiting']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('seller')
      expect(response.body.deal.status).to.equal('deposit_waiting')
      expect(response.body.deal.payout_requisite).to.not.equal(null)
      expect(response.body.deal.payout_requisite_id).to.not.equal(null)
      expect(response.body.deal.buyer_contacts).to.not.equal(null)
      expect(response.body.deal.seller_contacts).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Покупатель принял сделку, ждем оплаты`)
    })
  })
})

describe('Open Deal Waiting-Performing Block', () => {
  it('Render page for Buyer Terminal', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/waitingPerformingBuyerTerminal.json' }).as('getDealWaitingPerforming')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealWaitingPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('buyer')
      expect(response.body.deal.status).to.equal('waiting_performing')
      expect(response.body.deal.buyer_contacts).to.not.equal(null)
      expect(response.body.deal.seller_contacts).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Ожидаем отправки товара`)

      const deliveryCompanyData = getDeliveryCompany(response.body.deal.delivery.delivery_company)

      cy.contains(`Продавцу создана накладная для передачи товара службе доставки ${deliveryCompanyData.name}`)
      cy.contains('Обязательно ознакомьтесь с разделом справки').contains(`Доставка ${deliveryCompanyData.name}`)
      cy.contains('Посылка будет доставлена в пункт выдачи по адресу:')
      cy.contains(`${response.body.deal.receiver_city_name}, ${response.body.deal.terminal_address}`)

      // Check additional info
      checkAdditionalInfoLink('buyer')

      // Check deal menu
      cy.get('.dotted-menu').as('dealMenu')
      cy.get('@dealMenu').find('.dotted-menu__toggler').click()
      const dealId = response.body.deal['~id']
      const dealCopyLink = Cypress.env('frontUrl').replace(/^(https?:|)\/\//, '') + '/deals/' + dealId
      cy.get('@dealMenu').contains(dealCopyLink)
      cy.get('@dealMenu').contains('Дублировать').not('have.class', 'dotted-menu__item_disabled') // GET http://localhost:3000/deals/1234567890/copy
      cy.get('@dealMenu').contains('Редактировать').should('have.class', 'dotted-menu__item_disabled')

      // Check seller contacts
      cy.get('[data-test=deliveryInfo]').as('deliveryBlock')
      const fullBuyerName = `${response.body.deal.buyer_contacts.first_name} ${response.body.deal.buyer_contacts.middle_name} ${response.body.deal.buyer_contacts.last_name}`
      cy.get('@deliveryBlock').find('[data-test=receiverCity]').invoke('text').should('eq', response.body.deal.receiver_city_name)
      cy.get('@deliveryBlock').find('[data-test=buyerName]').invoke('text').should('eq', fullBuyerName)
      cy.get('@deliveryBlock').find('[data-test=buyerPhone]').invoke('text').should('eq', response.body.deal.buyer_contacts.phone)
    })
  })
  it('Render page for Buyer Door', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/waitingPerformingBuyerDoor.json' }).as('getDealWaitingPerforming')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealWaitingPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('buyer')
      expect(response.body.deal.status).to.equal('waiting_performing')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Ожидаем отправки товара`)
      cy.contains('Посылка будет доставлена курьером до адреса:')
      cy.contains(`${response.body.deal.receiver_courier_info.city}, ${response.body.deal.receiver_courier_info.street}, ${response.body.deal.receiver_courier_info.house}, ${response.body.deal.receiver_courier_info.flat}`)
    })
  })
  it('Render page for Buyer Self Delivery', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/self_delivery/waitingPerformingBuyer.json' }).as('getDealWaitingPerforming')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealWaitingPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('buyer')
      expect(response.body.deal.status).to.equal('waiting_performing')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Ожидаем отправки товара`)
      cy.contains(`Ожидаем передачи товара службе доставки в срок до ${getOffsetDate(response.body.deal.status_updated_at, 5)}.`)
    })
  })
  it('Render page for Seller Terminal', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/waitingPerformingSellerTerminal.json' }).as('getDealWaitingPerforming')
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}/delivery-waybill`, { fixture: 'deal_details/deliveryWaybill.json' }).as('getDeliveryWaybill')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealWaitingPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('seller')
      expect(response.body.deal.status).to.equal('waiting_performing')
      expect(response.body.deal.buyer_contacts).to.not.equal(null)
      expect(response.body.deal.seller_contacts).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Покупатель оплатил сделку`)

      // Check additional info
      checkAdditionalInfoLink('seller')

      // Check deal menu
      cy.get('.dotted-menu').as('dealMenu')
      cy.get('@dealMenu').find('.dotted-menu__toggler').click()
      const dealId = response.body.deal['~id']
      const dealCopyLink = Cypress.env('frontUrl').replace(/^(https?:|)\/\//, '') + '/deals/' + dealId
      cy.get('@dealMenu').contains(dealCopyLink)
      cy.get('@dealMenu').contains('Дублировать').not('have.class', 'dotted-menu__item_disabled') // GET http://localhost:3000/deals/1234567890/copy
      cy.get('@dealMenu').contains('Редактировать').should('have.class', 'dotted-menu__item_disabled')
    })

    cy.wait(['@getDeliveryWaybill']).then(({ response }) => {
      cy.get('.alert').contains(response.body.dispatch_number)
      cy.get('.act-card').should('have.attr', 'href', response.body.url)
      cy.get('.act-card').contains(`Накладная № ${response.body.dispatch_number}`)
      cy.get('.act-card').contains(waybillDateFormat(response.body.date))

      const deliveryCompanyData = getDeliveryCompany(response.body.delivery_company)

      cy.contains('Список пунктов доставки').should('have.attr', 'href', getOfficesLink(response.body.delivery_company))
      cy.contains(`Передайте товар транспортной компании ${deliveryCompanyData.name}`)
    })
  })
  it('Render page for Seller Door', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/waitingPerformingSellerDoor.json' }).as('getDealWaitingPerforming')
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}/delivery-waybill`, { fixture: 'deal_details/deliveryWaybill.json' }).as('getDeliveryWaybill')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealWaitingPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('seller')
      expect(response.body.deal.status).to.equal('waiting_performing')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Ожидаем забора посылки`)

      cy.contains(`Курьер будет у вас ${draftCourierDateFormat(response.body.deal.sender_courier_info.date)} с ${response.body.deal.sender_courier_info.time_beg} до ${response.body.deal.sender_courier_info.time_end}`)
      cy.contains(`${response.body.deal.sender_courier_info.city}, ${response.body.deal.sender_courier_info.street}, ${response.body.deal.sender_courier_info.house}, ${response.body.deal.sender_courier_info.flat}`)
    })
  })
  it('Render page for Seller Self Delivery', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/self_delivery/waitingPerformingSeller.json' }).as('getDealWaitingPerforming')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealWaitingPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('seller')
      expect(response.body.deal.status).to.equal('waiting_performing')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Подтвердите отправку товара`)
      cy.contains(`Вы должны отправить посылку в срок до ${getOffsetDate(response.body.deal.status_updated_at, 5)}`)

      cy.intercept('POST', `${Cypress.env('backUrl')}/temporary-token`, { fixture: 'deal_create/fileUploadToken.json' }).as('getTemporaryToken')
      cy.intercept('POST', `${Cypress.env('backUrl')}/form-upload**`, { fixture: 'deal_create/fileUpload.json' }).as('getUploadedFile')
      cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/delivery-info`, { fixture: 'deal_details/self_delivery/setDeliveryInfo.json' })

      cy.get('[data-test=selfDeliveryCompany]').type('DHL')
      cy.get('[data-test=selfDeliveryDispatchNumber]').type('1234567890')
      const fixtureFile = 'common/testFile.jpg'
      cy.get('[data-test=selfDeliveryFile]').attachFile(fixtureFile)
      cy.get('[data-test=selfDeliveryComment]').type('Test comment')
      cy.wait(['@getUploadedFile']).then(({ response }) => {
        expect(response.statusCode).to.eq(200)
        expect(response.body.collection.length).to.not.equal(0)
        cy.get('.loaded-file__list').should('exist')
        cy.get('.loaded-file__list').find('[data-test=selfDeliveryRemoveFile]').click()
        cy.get('.loaded-file__list').should('not.exist')
        const fixtureFile = 'common/testFile.jpg'
        cy.get('[data-test=selfDeliveryFile]').attachFile(fixtureFile)

        cy.get('[data-test=sendSelfDeliveryInfo]').click()
      })
    })
  })
})

describe('Open Deal Performing Block', () => {
  it('Render page for Buyer', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/performingBuyer.json' }).as('getDealPerforming')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('buyer')
      expect(response.body.deal.status).to.equal('performing')
      expect(response.body.deal.buyer_contacts).to.not.equal(null)
      expect(response.body.deal.seller_contacts).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Посылка в пути`)

      const deliveryCompanyData = getDeliveryCompany(response.body.deal.delivery.delivery_company)

      cy.contains(`Продавец передал товар в службу доставки ${deliveryCompanyData.name}`)
      cy.contains('Обязательно ознакомьтесь с разделом справки').contains(`Доставка ${deliveryCompanyData.name}`)
      cy.contains('Посылка будет доставлена в пункт выдачи по адресу:')
      cy.contains(`${response.body.deal.receiver_city_name}, ${response.body.deal.terminal_address}`)

      cy.contains(`Создана накладная № ${response.body.deal.delivery.dispatch_number}`)

      // Check additional info
      checkAdditionalInfoLink('buyer')

      checkPerformingTrack(response.body.deal.performing_track)
    })
  })
  it('Render page for Buyer with Self Delivery', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/self_delivery/performingBuyer.json' }).as('getDealPerforming')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('buyer')
      expect(response.body.deal.status).to.equal('performing')
      expect(response.body.deal.buyer_contacts).to.not.equal(null)
      expect(response.body.deal.seller_contacts).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Подтверждение исполнения сделки`)

      cy.contains('.alert', `По окончанию срока исполнения сделки деньги будут автоматически перечислены продавцу.`)

      cy.contains(`Срок исполнения сделки`)
      cy.contains(`${getOffsetDate(response.body.deal.status_updated_at, 19)}`)
      cy.contains(`Служба доставки`)
      cy.contains(`${response.body.deal.delivery.name}`)
      cy.contains(`Номер накладной`)
      cy.contains(`${response.body.deal.delivery.dispatch_number}`)
      cy.contains(`Комментарий от продавца`)
      cy.contains(`${response.body.deal.delivery.comment}`)
      cy.get('.loaded-file__list').should('exist')
      response.body.deal.delivery.attachments.forEach(item => {
        cy.contains(`${item.id.split('/')[1]}`).should('have.attr', 'href', item.public_url)
      })

      cy.contains(`Создана накладная № ${response.body.deal.delivery.dispatch_number}`)

      // Check additional info
      checkAdditionalInfoLink('buyer')

      checkPerformingTrack(response.body.deal.performing_track)

      cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/completion`, { fixture: 'deal_details/self_delivery/confirmDeal.json' }).as('sendConfirmDeal')
      cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/sms-check`, {})
      cy.intercept('POST', `${Cypress.env('backUrl')}/deals/${dealId}/sms-send`, {}).as('smsCheckConfirm')

      cy.get('[data-test=confirmSelfDeliveryDeal]').click()
      cy.get('[data-modal=dealWithoutDeliveryConfirm]').contains('Проверка безопасности')
      cy.get('[data-test=smsCheckResend]').click()
      cy.wait(['@smsCheckConfirm']).then(() => {
        cy.contains('Повторное СМС с кодом успешно отправлено.')
      })
      cy.get('[data-test=smsCheckConfirm]').click()
      cy.get('.input__error').should('be.exist')
      cy.get('[data-test=smsCheckInput]').type('12345')
      cy.get('.input__error').should('be.exist')
      cy.get('[data-test=smsCheckInput]').type(`{selectAll}1234`)
      cy.get('[data-test=smsCheckConfirm]').click()
      cy.wait(['@sendConfirmDeal']).then(() => {
        cy.get('[data-modal=dealWithoutDeliveryConfirm]').should('not.exist')
      })
    })
  })
  it('Render page for Seller', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/performingSeller.json' }).as('getDealPerforming')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('seller')
      expect(response.body.deal.status).to.equal('performing')
      expect(response.body.deal.buyer_contacts).to.not.equal(null)
      expect(response.body.deal.seller_contacts).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Посылка в пути`)

      const deliveryCompanyData = getDeliveryCompany(response.body.deal.delivery.delivery_company)

      cy.contains(`Вы передали товар в службу доставки ${deliveryCompanyData.name}`)

      cy.contains(`Создана накладная № ${response.body.deal.delivery.dispatch_number}`)

      // Check additional info
      checkAdditionalInfoLink('seller')

      checkPerformingTrack(response.body.deal.performing_track)
    })
  })
  it('Render page for Seller with Self Delivery', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/self_delivery/performingSeller.json' }).as('getDealPerforming')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealPerforming']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('seller')
      expect(response.body.deal.status).to.equal('performing')
      expect(response.body.deal.buyer_contacts).to.not.equal(null)
      expect(response.body.deal.seller_contacts).to.not.equal(null)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Посылка в пути`)

      cy.contains(`Срок исполнения сделки`)
      cy.contains(`${getOffsetDate(response.body.deal.status_updated_at, 19)}`)
      cy.contains(`Служба доставки`)
      cy.contains(`${response.body.deal.delivery.name}`)
      cy.contains(`Номер накладной`)
      cy.contains(`${response.body.deal.delivery.dispatch_number}`)
      cy.contains(`Комментарий`)
      cy.contains(`${response.body.deal.delivery.comment}`)
      cy.get('.loaded-file__list').should('exist')
      response.body.deal.delivery.attachments.forEach(item => {
        cy.contains(`${item.id.split('/')[1]}`).should('have.attr', 'href', item.public_url)
      })

      cy.contains(`Создана накладная № ${response.body.deal.delivery.dispatch_number}`)

      // Check additional info
      checkAdditionalInfoLink('seller')

      checkPerformingTrack(response.body.deal.performing_track)
    })
  })
})

describe('Open Deal Completion Block', () => {
  it('Render page for Buyer', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/completionBuyer.json' }).as('getDealCompletion')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealCompletion']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.deal.status).to.equal('completion')
      expect(response.body.requested_by).to.equal('buyer')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Производится выплата`)
      cy.contains('Вы забрали товар. Продавец получит деньги в ближайшее время.')

      cy.contains(`Создана накладная № ${response.body.deal.delivery.dispatch_number}`)
      checkPerformingTrack(response.body.deal.performing_track)
    })
  })
  it('Render page for Seller', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/completionSeller.json' }).as('getDealCompletion')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealCompletion']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.deal.status).to.equal('completion')
      expect(response.body.requested_by).to.equal('seller')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Производится выплата`)
      cy.contains(`Выплата будет произведена на карту ${response.body.deal.payout_requisite.number}`)

      cy.contains(`Создана накладная № ${response.body.deal.delivery.dispatch_number}`)
      checkPerformingTrack(response.body.deal.performing_track)
    })
  })
})

describe('Open Deal Completed Block', () => {
  it('Render page', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/completed.json' }).as('getDealCompleted')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealCompleted']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.deal.status).to.equal('completed')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Сделка успешно завершена`)
      cy.contains('Спасибо, что воспользовались сервисом.')
    })
  })
})

describe('Open Deal Cancellation Block', () => {
  it('Render page', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/cancellation.json' }).as('getDealCancellation')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealCancellation']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.deal.status).to.equal('cancellation')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Сделка в процессе отмены`)
    })
  })
})

describe('Open Deal Canceled Block', () => {
  it('Render page', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/canceled.json' }).as('getDealCanceled')
    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealCanceled']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.deal.status).to.equal('canceled')

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4.red-color', `Сделка отменена`)
      cy.contains('создать новую сделку').should('have.attr', 'href', '/deals/create')
    })
  })
})

describe('Open Deal Exception Block', () => {
  it('Render Deal with Requisite Change for Seller', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/depositWaitingSellerWithRequisiteChange.json' }).as('getDealDepositWaiting')
    cy.intercept('GET', `${Cypress.env('backUrl')}/requisites-selector/list`, { fixture: 'deal_details/requisitesList.json' })

    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealDepositWaiting']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.requested_by).to.equal('seller')
      expect(response.body.deal.requisite_change_required).to.equal(true)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `Замените карту`)

      cy.contains(`мы не можем выплатить вознаграждение на карту ${response.body.deal.payout_requisite.number}`)
    })
  })
  it('Render Deal with Terminal Change', () => {
    checkRenderingBasePage()
    cy.intercept('GET', `${Cypress.env('backUrl')}/deals/${dealId}`, { fixture: 'deal_details/depositWaitingWithTerminalChange.json' }).as('getDealDepositWaiting')

    cy.visit(`${Cypress.env('frontUrl')}/deals/${dealId}`)

    cy.wait(['@getDealDepositWaiting']).then(({ response }) => {
      expect(response.statusCode).to.eq(200)
      expect(response.body.deal.terminal_change_required).to.equal(true)

      cy.contains('h1', `Сделка ${response.body.deal.id_formatted}`)
      cy.contains('h4', `В сделке выбран неактуальный пункт выдачи`)
    })
  })
});
