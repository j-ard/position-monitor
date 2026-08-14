import AccountStrip from './components/AccountStrip'
import Banner from './components/Banner'
import Blotter from './components/Blotter'
import Fills from './components/Fills'
import StatusFooter from './components/StatusFooter'
import Ticket from './components/Ticket'

export default function App() {
  return (
    <div className="app">
      <AccountStrip />
      <Banner />
      <main>
        <div className="left"><Blotter /></div>
        <aside className="rail"><Ticket /><Fills /></aside>
      </main>
      <StatusFooter />
    </div>
  )
}
